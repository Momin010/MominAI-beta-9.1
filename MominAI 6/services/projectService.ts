import { supabase } from '../lib/supabaseClient';
import { FileSystem, AiProvider, Project, ProjectVersion } from '../types';

export const projectService = {
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
    return data || [];
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
    const { data, error } = await supabase
      .from('projects')
      .update({ file_system, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
        console.error("Supabase error updating project:", error);
        throw error;
    }
    return data;
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
