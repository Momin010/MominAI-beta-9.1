import { supabase } from '../lib/supabaseClient';
import { FileSystem, AiProvider, Project, ProjectVersion } from '../types';

interface StorageStats {
  totalProjects: number;
  totalVersions: number;
  totalFileSize: number;
  averageProjectSize: number;
  oldestProject: Date | null;
  newestProject: Date | null;
}

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressedData: string;
}

export const projectService = {
  // Compress file system data using basic string compression
  compressFileSystem(fs: FileSystem): CompressionResult {
    const jsonString = JSON.stringify(fs);
    const originalSize = jsonString.length;

    // Simple compression: remove unnecessary whitespace and use shorter keys
    const compressed = jsonString
      .replace(/\s+/g, ' ')
      .replace(/": "/g, '":"')
      .replace(/", "/g, '","');

    const compressedSize = compressed.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      compressedData: compressed
    };
  },

  // Decompress file system data
  decompressFileSystem(compressedData: string): FileSystem {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      // Fallback: try parsing as-is if decompression fails
      console.warn('Failed to decompress file system data, using as-is');
      return JSON.parse(compressedData);
    }
  },

  // Get storage statistics for the user
  async getStorageStats(): Promise<StorageStats> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const [projectsResult, versionsResult] = await Promise.all([
      supabase.from('projects').select('file_system, created_at, updated_at').eq('user_id', user.id),
      supabase.from('project_versions').select('file_system, created_at').eq('user_id', user.id)
    ]);

    if (projectsResult.error) throw projectsResult.error;
    if (versionsResult.error) throw versionsResult.error;

    const projects = projectsResult.data || [];
    const versions = versionsResult.data || [];

    let totalFileSize = 0;
    let oldestProject: Date | null = null;
    let newestProject: Date | null = null;

    // Calculate file sizes and dates
    for (const project of projects) {
      const size = JSON.stringify(project.file_system).length;
      totalFileSize += size;

      const created = new Date(project.created_at);
      const updated = new Date(project.updated_at);

      if (!oldestProject || created < oldestProject) oldestProject = created;
      if (!newestProject || updated > newestProject) newestProject = updated;
    }

    for (const version of versions) {
      totalFileSize += JSON.stringify(version.file_system).length;
    }

    return {
      totalProjects: projects.length,
      totalVersions: versions.length,
      totalFileSize,
      averageProjectSize: projects.length > 0 ? totalFileSize / projects.length : 0,
      oldestProject,
      newestProject
    };
  },

  // Clean up old project versions (keep only last N versions per project)
  async cleanupOldVersions(keepVersions: number = 10): Promise<{ deletedCount: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get all project IDs for the user
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id);

    if (projectsError) throw projectsError;

    let totalDeleted = 0;

    for (const project of projects || []) {
      // Get versions for this project, ordered by creation date (newest first)
      const { data: versions, error: versionsError } = await supabase
        .from('project_versions')
        .select('id')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (versionsError) continue;

      // Delete versions beyond the keep limit
      if (versions && versions.length > keepVersions) {
        const versionsToDelete = versions.slice(keepVersions);
        const { error: deleteError } = await supabase
          .from('project_versions')
          .delete()
          .in('id', versionsToDelete.map(v => v.id));

        if (!deleteError) {
          totalDeleted += versionsToDelete.length;
        }
      }
    }

    return { deletedCount: totalDeleted };
  },

  // Optimize storage by compressing old projects
  async optimizeStorage(): Promise<{ optimizedProjects: number; spaceSaved: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, file_system, updated_at')
      .eq('user_id', user.id)
      .lt('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Older than 30 days

    if (error) throw error;

    let optimizedCount = 0;
    let totalSpaceSaved = 0;

    for (const project of projects || []) {
      const compression = this.compressFileSystem(project.file_system);
      if (compression.compressionRatio > 10) { // Only compress if we save more than 10%
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            file_system: { __compressed: true, data: compression.compressedData },
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id);

        if (!updateError) {
          optimizedCount++;
          totalSpaceSaved += compression.originalSize - compression.compressedSize;
        }
      }
    }

    return { optimizedProjects: optimizedCount, spaceSaved: totalSpaceSaved };
  },

  async getProjectsForUser(): Promise<Project[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
        console.error("Supabase error getting projects:", error);
        throw error;
    }

    // Decompress file systems if needed
    return (data || []).map(project => ({
      ...project,
      file_system: project.file_system?.__compressed
        ? this.decompressFileSystem(project.file_system.data)
        : project.file_system
    }));
  },
  
  async createProject(
    name: string,
    provider: AiProvider,
    file_system: FileSystem
  ): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, provider, file_system, user_id: user.id })
      .select()
      .single();
      
    if (error) {
        console.error("Supabase error creating project:", error);
        throw error;
    }
    return data;
  },

  async updateProject(
    id: string,
    file_system: FileSystem
  ): Promise<Project> {
    // Compress large file systems to optimize storage
    const shouldCompress = JSON.stringify(file_system).length > 50000; // Compress if > 50KB
    const finalFileSystem = shouldCompress
      ? { __compressed: true, data: this.compressFileSystem(file_system).compressedData }
      : file_system;

    const { data, error } = await supabase
      .from('projects')
      .update({ file_system: finalFileSystem, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
        console.error("Supabase error updating project:", error);
        throw error;
    }

    // Return decompressed data for consistency
    return {
      ...data,
      file_system: data.file_system?.__compressed
        ? this.decompressFileSystem(data.file_system.data)
        : data.file_system
    };
  },

  async createProjectVersion(
    projectId: string,
    file_system: FileSystem,
    summary?: string
  ): Promise<ProjectVersion> {
    const { data, error } = await supabase
      .from('project_versions')
      .insert({ project_id: projectId, file_system, summary })
      .select()
      .single();

    if (error) {
      console.error("Supabase error creating project version:", error);
      throw error;
    }
    return data;
  },

  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase error getting project versions:", error);
      throw error;
    }
    return data || [];
  },
};
