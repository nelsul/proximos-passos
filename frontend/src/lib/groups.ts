import { api } from "./api";

export interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  access_type: "open" | "closed";
  visibility_type: "public" | "private";
  thumbnail_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupListResponse {
  data: GroupResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  access_type?: "open" | "closed";
  visibility_type?: "public" | "private";
}

export interface GroupFilter {
  name?: string;
  access_type?: string;
  visibility_type?: string;
}

function buildQuery(page: number, size: number, filter?: GroupFilter): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.name) params.set("name", filter.name);
  if (filter?.access_type) params.set("access_type", filter.access_type);
  if (filter?.visibility_type)
    params.set("visibility_type", filter.visibility_type);
  return params.toString();
}

export async function listGroups(
  page = 1,
  size = 10,
  filter?: GroupFilter,
): Promise<GroupListResponse> {
  return api<GroupListResponse>(`/groups?${buildQuery(page, size, filter)}`);
}

export async function listMyGroups(
  page = 1,
  size = 10,
  filter?: GroupFilter,
): Promise<GroupListResponse> {
  return api<GroupListResponse>(`/me/groups?${buildQuery(page, size, filter)}`);
}

export async function createGroup(
  input: CreateGroupInput,
): Promise<GroupResponse> {
  return api<GroupResponse>("/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface GroupMemberResponse {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "admin" | "supervisor" | "member";
  is_active: boolean;
  joined_at: string;
  updated_at: string;
}

export interface GroupMemberListResponse {
  data: GroupMemberResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export async function listGroupMembers(
  groupId: string,
  page = 1,
  size = 10,
  role?: string,
): Promise<GroupMemberListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (role) params.set("role", role);
  return api<GroupMemberListResponse>(
    `/groups/${groupId}/members?${params.toString()}`,
  );
}

export interface JoinGroupResponse {
  status: "accepted" | "pending";
}

export async function joinGroup(groupId: string): Promise<JoinGroupResponse> {
  return api<JoinGroupResponse>(`/groups/${groupId}/join`, {
    method: "POST",
  });
}

export type MembershipStatus = "none" | "pending" | "member";

export interface MembershipResponse {
  status: MembershipStatus;
  role?: "admin" | "supervisor" | "member";
}

export async function checkMembership(
  groupId: string,
): Promise<MembershipResponse> {
  return api<MembershipResponse>(`/groups/${groupId}/membership`);
}

export async function getGroup(groupId: string): Promise<GroupResponse> {
  return api<GroupResponse>(`/groups/${groupId}`);
}

export async function getGroupPreview(groupId: string): Promise<GroupResponse> {
  return api<GroupResponse>(`/groups/${groupId}/preview`);
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  access_type?: "open" | "closed";
  visibility_type?: "public" | "private";
}

export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupResponse> {
  return api<GroupResponse>(`/groups/${groupId}/admin/update`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function uploadGroupThumbnail(
  groupId: string,
  file: File,
): Promise<GroupResponse> {
  const formData = new FormData();
  formData.append("thumbnail", file);
  return api<GroupResponse>(`/groups/${groupId}/admin/thumbnail`, {
    method: "PUT",
    body: formData,
    headers: {},
  });
}

export async function deleteGroupThumbnail(
  groupId: string,
): Promise<GroupResponse> {
  return api<GroupResponse>(`/groups/${groupId}/admin/thumbnail`, {
    method: "DELETE",
  });
}

export async function listPendingMembers(
  groupId: string,
  page = 1,
  size = 10,
): Promise<GroupMemberListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  return api<GroupMemberListResponse>(
    `/groups/${groupId}/members/pending?${params.toString()}`,
  );
}

export async function approveMember(
  groupId: string,
  userId: string,
): Promise<void> {
  return api<void>(`/groups/${groupId}/members/${userId}/approve`, {
    method: "POST",
  });
}

export async function rejectMember(
  groupId: string,
  userId: string,
): Promise<void> {
  return api<void>(`/groups/${groupId}/members/${userId}/reject`, {
    method: "POST",
  });
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  return api<void>(`/groups/${groupId}/admin/members/${userId}`, {
    method: "DELETE",
  });
}

export async function updateMemberRoleAsGroupAdmin(
  groupId: string,
  userId: string,
  role: "admin" | "supervisor" | "member"
): Promise<void> {
  return api<void>(`/groups/${groupId}/admin/members/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}
