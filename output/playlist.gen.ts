import { type ResourceList, type Resource, type MetaStatus } from "./commonLib";
var injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    listPlaylist: build.query<ListPlaylistResponse, ListPlaylistParams>({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists`,
        params: {
          continue: queryArg["continue"],
          fieldSelector: stringifySelector(queryArg.fieldSelector),
          labelSelector: stringifySelector(queryArg.labelSelector),
          limit: queryArg.limit,
        },
      }),
    }),
    postPlaylist: build.mutation<PostPlaylistResponse, PostPlaylistParams>({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists`,
      }),
    }),
    getPlaylist: build.query<GetPlaylistResponse, GetPlaylistParams>({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists/${queryArg.name}`,
      }),
    }),
    putPlaylist: build.mutation<PutPlaylistResponse, PutPlaylistParams>({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists/${queryArg.name}`,
      }),
    }),
    deletePlaylist: build.mutation<
      DeletePlaylistResponse,
      DeletePlaylistParams
    >({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists/${queryArg.name}`,
      }),
    }),
    patchPlaylist: build.mutation<PatchPlaylistResponse, PatchPlaylistParams>({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/namespaces/${config["namespace"]}/playlists/${queryArg.name}`,
      }),
    }),
    listPlaylistForAllNamespaces: build.query<
      ListPlaylistForAllNamespacesResponse,
      ListPlaylistForAllNamespacesParams
    >({
      query: (queryArg) => ({
        url: `/apis/playlist.grafana.app/v0alpha1/playlists`,
        params: {
          continue: queryArg["continue"],
          fieldSelector: stringifySelector(queryArg.fieldSelector),
          labelSelector: stringifySelector(queryArg.labelSelector),
          limit: queryArg.limit,
        },
      }),
    }),
  }),
});
export type ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Item = {
  type: "dashboard_by_id" | "dashboard_by_tag" | "dashboard_by_uid";
  value: string;
};
// {"group":"playlist.grafana.app","version":"v0alpha1","kind":"Playlist"}
export type Playlist = {
  interval: string;
  items?: ComGithubGrafanaGrafanaPkgApisPlaylistV0Alpha1Item[];
  title: string;
};
export type ListPlaylistResponse = ResourceList<
  Playlist,
  "playlist.grafana.app"
>;
export type ListPlaylistParams = {
  ["continue"]?: string;
  fieldSelector?: string;
  labelSelector?: string;
  limit?: number;
};
export type PostPlaylistResponse = Resource<Playlist, "playlist.grafana.app">;
export type PostPlaylistParams = {};
export type GetPlaylistResponse = Resource<Playlist, "playlist.grafana.app">;
export type GetPlaylistParams = {
  name: string;
};
export type PutPlaylistResponse = Resource<Playlist, "playlist.grafana.app">;
export type PutPlaylistParams = {
  name: string;
};
export type DeletePlaylistResponse = MetaStatus;
export type DeletePlaylistParams = {
  name: string;
};
export type PatchPlaylistResponse = Resource<Playlist, "playlist.grafana.app">;
export type PatchPlaylistParams = {
  name: string;
};
export type ListPlaylistForAllNamespacesResponse = ResourceList<
  Playlist,
  "playlist.grafana.app"
>;
export type ListPlaylistForAllNamespacesParams = {
  ["continue"]?: string;
  fieldSelector?: string;
  labelSelector?: string;
  limit?: number;
};
