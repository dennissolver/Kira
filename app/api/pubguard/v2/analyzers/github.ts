// app/api/pubguard/v2/analyzers/github.ts
// Deep GitHub repository analysis

import type { GitHubAnalysis, Finding } from '../types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Permission keywords to detect in README/docs
const PERMISSION_PATTERNS = {
  shellAccess: [
    'shell access', 'execute commands', 'run commands', 'bash', 'terminal',
    'shell command', 'exec', 'spawn', 'child_process', 'system access'
  ],
  fileSystemAccess: [
    'read files', 'write files', 'file access', 'filesystem', 'file system',
    'read/write', 'fs access', 'directory access'
  ],
  networkAccess: [
    'network access', 'http requests', 'api calls', 'webhooks', 'outbound'
  ],
  credentialStorage: [
    'stores credentials', 'api keys', 'tokens', 'oauth', 'plaintext',
    'credential', '~/.', 'config file', 'secrets'
  ],
  browserControl: [
    'browser control', 'chrome', 'chromium', 'puppeteer', 'playwright',
    'cdp', 'browser automation'
  ],
  rootRequired: [
    'root access', 'sudo', 'administrator', 'elevated privileges', 'root permission'
  ]
};

// Security-related commit keywords
const SECURITY_COMMIT_KEYWORDS = [
  'security', 'vulnerability', 'vuln', 'cve', 'fix', 'patch', 'exploit',
  'injection', 'xss', 'csrf', 'auth', 'authentication', 'sanitize', 'escape'
];

async function githubFetch(endpoint: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PubGuard-Security-Scanner',
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  
  if (!response.ok) {
    if (response.status === 404) {
      // Could be private or doesn't exist
      return { _notFound: true, _status: 404 };
    }
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit exceeded');
      }
      // 403 without rate limit = private repo
      return { _private: true, _status: 403 };
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

// Fetch file content from repo
async function getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const data = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`);
    if (data?.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

// Analyze text for permission patterns
function detectPermissions(text: string): GitHubAnalysis['permissions'] {
  const lowerText = text.toLowerCase();
  
  return {
    shellAccess: PERMISSION_PATTERNS.shellAccess.some(p => lowerText.includes(p)),
    fileSystemAccess: PERMISSION_PATTERNS.fileSystemAccess.some(p => lowerText.includes(p)),
    networkAccess: PERMISSION_PATTERNS.networkAccess.some(p => lowerText.includes(p)),
    credentialStorage: PERMISSION_PATTERNS.credentialStorage.some(p => lowerText.includes(p)),
    browserControl: PERMISSION_PATTERNS.browserControl.some(p => lowerText.includes(p)),
    rootRequired: PERMISSION_PATTERNS.rootRequired.some(p => lowerText.includes(p)),
  };
}

// Search commits for security-related changes
async function getSecurityCommits(
  owner: string, 
  repo: string, 
  limit: number = 100
): Promise<GitHubAnalysis['recentSecurityCommits']> {
  const commits = await githubFetch(`/repos/${owner}/${repo}/commits?per_page=${limit}`);
  if (!commits) return [];

  return commits
    .filter((c: any) => {
      const msg = c.commit.message.toLowerCase();
      return SECURITY_COMMIT_KEYWORDS.some(kw => msg.includes(kw));
    })
    .slice(0, 20)
    .map((c: any) => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0].substring(0, 100),
      date: c.commit.author.date,
    }));
}

// Get security-labeled issues
async function getSecurityIssues(
  owner: string, 
  repo: string
): Promise<GitHubAnalysis['securityLabeledIssues']> {
  try {
    const result = await githubFetch(
      `/search/issues?q=repo:${owner}/${repo}+label:security+state:open&per_page=20`
    );
    
    return (result?.items || []).map((issue: any) => ({
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      createdAt: issue.created_at,
    }));
  } catch {
    return [];
  }
}

// Get security advisories
async function getSecurityAdvisories(owner: string, repo: string): Promise<number> {
  if (!GITHUB_TOKEN) return 0;
  
  try {
    const query = `
      query {
        repository(owner: "${owner}", name: "${repo}") {
          vulnerabilityAlerts(first: 100) {
            totalCount
          }
          securityAdvisories(first: 10) {
            totalCount
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    const vulns = data?.data?.repository?.vulnerabilityAlerts?.totalCount || 0;
    const advisories = data?.data?.repository?.securityAdvisories?.totalCount || 0;
    return vulns + advisories;
  } catch {
    return 0;
  }
}

// Check for previous names/renames
async function checkForRenames(owner: string, repo: string, readme: string): Promise<string[]> {
  const previousNames: string[] = [];
  
  // Common rename patterns in READMEs
  const renamePatterns = [
    /formerly\s+(?:known\s+as\s+)?["']?(\w+)["']?/gi,
    /previously\s+(?:called\s+)?["']?(\w+)["']?/gi,
    /renamed\s+(?:from\s+)?["']?(\w+)["']?/gi,
    /was\s+(?:called\s+)?["']?(\w+)["']?/gi,
  ];

  for (const pattern of renamePatterns) {
    const matches = readme.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !previousNames.includes(match[1])) {
        previousNames.push(match[1]);
      }
    }
  }

  // Specific known renames (hardcoded for known projects)
  const knownRenames: Record<string, string[]> = {
    'openclaw': ['clawdbot', 'moltbot'],
    'moltbot': ['clawdbot'],
  };
  
  const repoLower = repo.toLowerCase();
  if (knownRenames[repoLower]) {
    previousNames.push(...knownRenames[repoLower]);
  }

  return [...new Set(previousNames)];
}

// Main analysis function
export async function analyzeGitHubRepo(url: string): Promise<{
  analysis: GitHubAnalysis | null;
  findings: Finding[];
  isPrivate: boolean;
  error?: string;
}> {
  // Parse URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }
  
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  // Fetch repo data
  const repoData = await githubFetch(`/repos/${owner}/${repo}`);
  
  // Check if private or not found
  if (repoData?._private || repoData?._notFound) {
    const isPrivate = repoData._private || false;
    return {
      analysis: null,
      findings: [{
        severity: 'medium',
        category: 'Access',
        title: isPrivate ? 'Private Repository' : 'Repository Not Found',
        description: isPrivate 
          ? 'This is a private repository. We cannot access the source code, README, or commit history. Only external checks (CVE database, security news, exposure scans) will be performed.'
          : 'This repository does not exist or has been deleted.',
        source: 'GitHub API',
        sourceUrl: url,
      }],
      isPrivate,
      error: isPrivate 
        ? 'Private repository - limited analysis available' 
        : 'Repository not found',
    };
  }

  // Fetch additional data in parallel
  const [
    readme,
    securityMd,
    contributors,
    securityCommits,
    securityIssues,
    advisoriesCount,
  ] = await Promise.all([
    getFileContent(owner, repo, 'README.md'),
    getFileContent(owner, repo, 'SECURITY.md'),
    githubFetch(`/repos/${owner}/${repo}/contributors?per_page=100`),
    getSecurityCommits(owner, repo),
    getSecurityIssues(owner, repo),
    getSecurityAdvisories(owner, repo),
  ]);

  // Calculate temporal metrics
  const now = new Date();
  const createdAt = new Date(repoData.created_at);
  const pushedAt = new Date(repoData.pushed_at);
  const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceLastCommit = Math.floor((now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate velocity
  const starsPerDay = ageInDays > 0 ? repoData.stargazers_count / ageInDays : repoData.stargazers_count;
  const isViralGrowth = starsPerDay > 500; // More than 500 stars/day = viral

  // Analyze permissions from README
  const combinedText = `${readme || ''} ${securityMd || ''} ${repoData.description || ''}`;
  const permissions = detectPermissions(combinedText);

  // Check for renames
  const previousNames = await checkForRenames(owner, repo, readme || '');
  const recentRename = previousNames.length > 0;

  // Check for code of conduct and contributing
  const [hasCodeOfConduct, hasContributing] = await Promise.all([
    getFileContent(owner, repo, 'CODE_OF_CONDUCT.md').then(c => c !== null),
    getFileContent(owner, repo, 'CONTRIBUTING.md').then(c => c !== null),
  ]);

  const analysis: GitHubAnalysis = {
    url: repoData.html_url,
    owner: repoData.owner.login,
    name: repoData.name,
    description: repoData.description || '',
    
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    watchers: repoData.watchers_count,
    openIssues: repoData.open_issues_count,
    
    createdAt: repoData.created_at,
    lastCommit: repoData.pushed_at,
    daysSinceLastCommit,
    ageInDays,
    
    // Content for security analysis
    readme: readme || '',
    hasSecurityMd: securityMd !== null,
    securityMdContent: securityMd || undefined,
    
    hasSecurityPolicy: securityMd !== null,
    securityPolicyContent: securityMd || undefined,
    hasSecurityAdvisories: advisoriesCount > 0,
    securityAdvisoriesCount: advisoriesCount,
    
    permissions,
    
    recentSecurityCommits: securityCommits,
    securityLabeledIssues: securityIssues,
    
    contributors: contributors?.length || 0,
    topContributors: (contributors || []).slice(0, 5).map((c: any) => c.login),
    
    license: repoData.license?.spdx_id || null,
    hasCodeOfConduct,
    hasContributing,
    
    starsPerDay,
    isViralGrowth,
    
    previousNames,
    recentRename,
  };

  // Generate findings
  const findings: Finding[] = [];

  // Permission-based findings
  if (permissions.shellAccess) {
    findings.push({
      severity: 'high',
      category: 'Architecture Risk',
      title: 'Requires shell/command execution access',
      description: 'This tool requires the ability to execute shell commands on your system, which poses significant security risks if compromised.',
      source: 'Codebase Analysis',
      sourceUrl: analysis.url,
    });
  }

  if (permissions.credentialStorage) {
    findings.push({
      severity: 'high',
      category: 'Data Security',
      title: 'Stores credentials locally',
      description: 'This tool stores API keys, tokens, or credentials on your system. Verify the storage method is secure.',
      source: 'Codebase Analysis',
      sourceUrl: analysis.url,
    });
  }

  if (permissions.rootRequired) {
    findings.push({
      severity: 'critical',
      category: 'Architecture Risk',
      title: 'Requires root/administrator access',
      description: 'This tool requires elevated system privileges, significantly increasing the blast radius if compromised.',
      source: 'Codebase Analysis',
      sourceUrl: analysis.url,
    });
  }

  // Velocity-based findings
  if (isViralGrowth) {
    findings.push({
      severity: 'medium',
      category: 'Vetting Risk',
      title: `Viral growth detected (${Math.round(starsPerDay)} stars/day)`,
      description: 'Extremely rapid adoption means less time for community security vetting. Exercise additional caution.',
      source: 'GitHub Analysis',
      sourceUrl: analysis.url,
    });
  }

  // Rename detection
  if (recentRename) {
    findings.push({
      severity: 'medium',
      category: 'Reputation',
      title: `Recent rename detected (previously: ${previousNames.join(', ')})`,
      description: 'Project was recently renamed, possibly due to legal pressure or rebranding after security issues.',
      source: 'GitHub Analysis',
      sourceUrl: analysis.url,
    });
  }

  // Security issues
  if (securityIssues.length > 0) {
    findings.push({
      severity: 'high',
      category: 'Active Vulnerabilities',
      title: `${securityIssues.length} open security-labeled issues`,
      description: `There are ${securityIssues.length} open issues labeled as security concerns.`,
      source: 'GitHub Issues',
      sourceUrl: `${analysis.url}/issues?q=label:security`,
    });
  }

  if (advisoriesCount > 0) {
    findings.push({
      severity: 'critical',
      category: 'Active Vulnerabilities',
      title: `${advisoriesCount} security advisories/alerts`,
      description: 'GitHub has detected security vulnerabilities in this repository or its dependencies.',
      source: 'GitHub Security',
      sourceUrl: `${analysis.url}/security`,
    });
  }

  // Positive findings
  if (analysis.hasSecurityPolicy) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'Has SECURITY.md policy',
      description: 'Project has documented security policy and responsible disclosure process.',
      source: 'GitHub Analysis',
      sourceUrl: `${analysis.url}/blob/main/SECURITY.md`,
    });
  }

  if (analysis.contributors > 50) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: `Active community (${analysis.contributors}+ contributors)`,
      description: 'Large contributor base suggests more eyes on the code.',
      source: 'GitHub Analysis',
      sourceUrl: analysis.url,
    });
  }

  if (securityCommits.length > 10) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'Active security maintenance',
      description: `${securityCommits.length} recent commits related to security fixes and improvements.`,
      source: 'GitHub Analysis',
      sourceUrl: `${analysis.url}/commits`,
    });
  }

  return { analysis, findings, isPrivate: false };
}
