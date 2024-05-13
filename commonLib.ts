export const ListOptions = "ListOptions" as const;
export const ListOptionsFieldSelector = "ListOptionsFieldSelector" as const;
export const ListOptionsLabelSelector = "ListOptionsLabelSelector" as const;
export const MetaStatus = "MetaStatus" as const;
export const Resource = "Resource" as const;
export const ResourceForCreate = "ResourceForCreate" as const;
export const ResourceList = "ResourceList" as const;
export const ResourceServer = "ResourceServer" as const;

const commonLibNames = [
    ListOptions,
    ListOptionsFieldSelector,
    ListOptionsLabelSelector,
    MetaStatus,
    Resource,
    ResourceForCreate,
    ResourceList,
    ResourceServer
];

export type CommonLibName = typeof commonLibNames[number];
