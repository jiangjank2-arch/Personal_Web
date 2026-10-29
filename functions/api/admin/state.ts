import type { FunctionContext } from '../../_lib/env.ts';
import { requireAdmin } from '../../_lib/auth.ts';
import { repoContext } from '../../_lib/github.ts';
import { loadCollection, readJsonConfig } from '../../_lib/content-repo.ts';
import { handleApiError, json } from '../../_lib/respond.ts';
import type { Profile, SiteConfig, Skill } from '../../../src/types/site.ts';

export const onRequestGet = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    const repo = repoContext(env);
    const [profile, skills, site, projects, blog] = await Promise.all([
      readJsonConfig<Profile>(repo, 'src/data/profile.json'),
      readJsonConfig<Skill[]>(repo, 'src/data/skills.json'),
      readJsonConfig<SiteConfig>(repo, 'src/data/site.json'),
      loadCollection(repo, 'projects'),
      loadCollection(repo, 'blog'),
    ]);
    return json({
      repo: { owner: repo.owner, name: repo.repo, branch: repo.branch },
      profile,
      skills,
      site,
      projects: projects.map(({ slug, path, data, body }) => ({ slug, path, frontmatter: data, body })),
      blog: blog.map(({ slug, path, data, body }) => ({ slug, path, frontmatter: data, body })),
    });
  } catch (error) {
    return handleApiError(error);
  }
};
