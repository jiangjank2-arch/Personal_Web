import { getCollection } from 'astro:content';

export const POSTS_PER_PAGE = 9;
export async function getPublishedProjects() {
  return (await getCollection('projects', ({ data }) => !data.draft))
    .sort((a, b) => a.data.order - b.data.order || a.data.slug.localeCompare(b.data.slug, 'en'));
}
export async function getPublishedPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt) || a.data.slug.localeCompare(b.data.slug, 'en'));
}
export async function getFeaturedProjects(limit: number) {
  return (await getPublishedProjects()).filter(({ data }) => data.featured).slice(0, limit);
}
export async function getLatestPosts(limit: number) {
  return (await getPublishedPosts()).slice(0, limit);
}

