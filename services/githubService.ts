import { FileSystem } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

export const githubService = {
  async createRepo(token: string, name: string, description: string): Promise<any> {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        name,
        description,
        private: false,
        // FIX: Initialize the repository with a README. Pushing to an empty repository
        // requires a different API flow, so creating an initial commit makes the process more robust.
        auto_init: true,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create repository');
    }
    return response.json();
  },

  async pushFilesToRepo(
    token: string,
    owner: string,
    repo: string,
    fileSystem: FileSystem,
    commitMessage: string
  ): Promise<any> {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
    };

    // Step 1: Get repository details to find the default branch name (e.g., 'main' or 'master')
    const repoDetailsRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
    if (!repoDetailsRes.ok) {
        const errorData = await repoDetailsRes.json();
        throw new Error(`Failed to get repository details: ${errorData.message}`);
    }
    const repoDetails = await repoDetailsRes.json();
    const defaultBranch = repoDetails.default_branch;

    // Step 2: Get the ref for the now-known default branch to find the latest commit SHA.
    const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, { headers });
    if (!refRes.ok) {
      const errorData = await refRes.json();
      throw new Error(`Failed to get default branch ref ('${defaultBranch}'): ${errorData.message}`);
    }
    const refData = await refRes.json();
    const parentCommitSha = refData.object.sha;

    // Step 3: Get the tree SHA from the latest commit. This is crucial.
    const parentCommitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, { headers });
    if (!parentCommitRes.ok) {
        const errorData = await parentCommitRes.json();
        throw new Error(`Failed to get parent commit details: ${errorData.message}`);
    }
    const parentCommitData = await parentCommitRes.json();
    const baseTreeSha = parentCommitData.tree.sha;

    // Step 4: Create a blob for each file.
    const fileBlobs = await Promise.all(
      Object.entries(fileSystem).map(async ([path, content]) => {
        const blobRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: content,
            encoding: 'utf-8',
          }),
        });
        if (!blobRes.ok) {
          const errorData = await blobRes.json();
          throw new Error(`Blob creation failed for ${path}: ${errorData.message}`);
        }
        const blobData = await blobRes.json();
        return {
          path,
          sha: blobData.sha,
          mode: '100644' as const,
          type: 'blob' as const,
        };
      })
    );
    
    // Step 5: Create a new tree with our file blobs, based on the previous tree.
    const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tree: fileBlobs,
        base_tree: baseTreeSha,
      }),
    });
    if (!treeRes.ok) {
      const errorData = await treeRes.json();
      throw new Error(`Tree creation failed: ${errorData.message}`);
    }
    const treeData = await treeRes.json();

    // Step 6: Create a new commit pointing to our new tree.
    const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [parentCommitSha], // Link it to the previous commit.
      }),
    });
    if (!commitRes.ok) {
      const errorData = await commitRes.json();
      throw new Error(`Commit creation failed: ${errorData.message}`);
    }
    const commitData = await commitRes.json();

    // Step 7: Update the default branch to point to our new commit.
    const updateRefRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: commitData.sha }),
    });
    if (!updateRefRes.ok) {
       const errorData = await updateRefRes.json();
       throw new Error(`Failed to update default branch ('${defaultBranch}'): ${errorData.message}`);
    }

    return updateRefRes.json();
  },
};