/**
 * Group Service
 * 
 * Service layer for group management.
 * Abstracts HTTP calls to backend /api/groups endpoints.
 */

import { http } from '../api/http';

/**
 * Group entity as returned from backend.
 */
export interface Group {
  id: number;
  name: string;
  description?: string;
  currency: {
    id: number;
    code: string;
    label: string;
  };
  totalAmount: number;
  userPersonalTotal: number;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  members: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  _count: {
    expenses: number;
    members: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for updating group
 */
export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  currency?: string;
}

/**
 * Fetch all groups for current user
 * GET /api/groups
 */
export async function getGroups(): Promise<Group[]> {
  const response = await http.get<Group[]>('/groups');
  return response.data;
}

/**
 * Fetch a single group by ID
 * GET /api/groups/:id
 */
export async function getGroup(groupId: number): Promise<Group> {
  const response = await http.get<{ success: boolean; data: Group }>(`/groups/${groupId}`);
  return response.data.data;
}

/**
 * Update/edit a group
 * PATCH /api/groups/:id
 
 * @param groupId - Group ID to update
 * @param data - Update data (name, description, currency)
 * @returns Updated group
 */
export async function updateGroup(groupId: number, data: UpdateGroupDTO): Promise<Group> {
  const response = await http.patch<Group>(`/groups/${groupId}`, data);
  return response.data;
}

/**
 * Add member to group by email
 * POST /api/groups/:id/members/email
 
 * @param groupId - Group ID
 * @param email - Email of user to add
 * @returns Updated group with new member
 */
export async function addMemberByEmail(groupId: number, email: string): Promise<{ data: Group; addedMember: { id: number; name: string; email: string } }> {
  const response = await http.post<{ success: boolean; data: Group; addedMember: { id: number; name: string; email: string } }>(
    `/groups/${groupId}/members/email`,
    { email }
  );
  return {
    data: response.data.data,
    addedMember: response.data.addedMember,
  };
}

/**
 * Remove a member from a group
 * DELETE /api/groups/:groupId/members/:memberId
 *
 * @param groupId - Group ID
 * @param memberId - Member ID to remove
 * @returns Updated group
 */
export async function removeMemberFromGroup(groupId: number, memberId: number): Promise<Group> {
  const response = await http.delete<{ data: Group }>(`/groups/${groupId}/members/${memberId}`);
  return response.data.data;
}

/**
 * Delete/deactivate a group
 * DELETE /api/groups/:id
 
 * @param groupId - Group ID to delete
 * @returns Deleted group
 */
export async function deleteGroup(groupId: number): Promise<Group> {
  const response = await http.delete<Group>(`/groups/${groupId}`);
  return response.data;
}
