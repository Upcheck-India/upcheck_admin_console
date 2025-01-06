export function validatePost(post) {
    const defaultValues = {
        title: "New post",
        content: "In the making",
        author: "Anonymous",
        tags: ["shrimpTag"],
        categories: ["In edit"]
    };

    return {
        ...post,
        author: post.author || defaultValues.author,
        translations: Object.entries(post.translations).reduce((acc, [lang, content]) => ({
            ...acc,
            [lang]: {
                title: content.title || defaultValues.title,
                content: content.content || defaultValues.content
            }
        }), post.translations),
        tags: post.tags.length ? post.tags : defaultValues.tags,
        categories: post.categories.length ? post.categories : defaultValues.categories
    };
}