import {
  createEntity,
  createRelation,
  createRelations,
  deleteElementById,
  deleteRelationsByFromAndTo,
  listThings,
  paginateAllThings,
  patchAttribute,
  updateAttribute,
} from '../../database/middleware';
import { internalLoadById, listEntitiesPaginated, storeLoadById } from '../../database/middleware-loader';
import { BUS_TOPICS } from '../../config/conf';
import { delEditContext, notify, setEditContext } from '../../database/redis';
import { BasicStoreEntityWorkspace, ENTITY_TYPE_WORKSPACE } from './workspace-types';
import { FunctionalError } from '../../config/errors';
import { ABSTRACT_INTERNAL_RELATIONSHIP, buildRefRelationKey } from '../../schema/general';
import { isInternalRelationship, RELATION_HAS_REFERENCE } from '../../schema/internalRelationship';
import type { AuthContext, AuthUser } from '../../types/user';
import type {
  EditContext,
  EditInput,
  MemberAccess,
  MemberAccessInput,
  QueryWorkspacesArgs,
  StixRefRelationshipAddInput,
  StixRefRelationshipsAddInput,
  WorkspaceAddInput,
  WorkspaceObjectsArgs
} from '../../generated/graphql';
import { findAllMembers } from '../../domain/user';
import {
  validateUserAccessOperation,
  MEMBER_ACCESS_RIGHT_ADMIN,
  isValidMemberAccessRight,
  getUserAccessRight
} from '../../utils/access';
import type { BasicStoreEntity } from '../../types/store';

export const findById = (context: AuthContext, user: AuthUser, workspaceId: string): BasicStoreEntityWorkspace => {
  return storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE) as unknown as BasicStoreEntityWorkspace;
};

export const findAll = (context: AuthContext, user: AuthUser, args: QueryWorkspacesArgs) => {
  const listArgs = { ...args, adminBypassUserAccess: args.adminBypassUserAccess ?? false };
  return listEntitiesPaginated<BasicStoreEntityWorkspace>(context, user, [ENTITY_TYPE_WORKSPACE], listArgs);
};

export const getAuthorizedMembers = async (context: AuthContext, user: AuthUser, workspace: BasicStoreEntityWorkspace): Promise<MemberAccess[]> => {
  let authorizedMembers: MemberAccess[] = [];
  if (!workspace.authorized_members?.length) {
    return authorizedMembers;
  }
  if (!validateUserAccessOperation(user, workspace, 'manage-access')) {
    return authorizedMembers; // return empty if user doesn't have the right access_right
  }
  const membersIds = workspace.authorized_members.map((e) => e.id);
  const args = {
    connectionFormat: false,
    first: 100,
    filters: [{ key: 'internal_id', values: membersIds }],
  };
  const members = await findAllMembers(context, user, args);
  authorizedMembers = workspace.authorized_members.map((am) => {
    const member = members.find((m) => (m as BasicStoreEntity).id === am.id) as BasicStoreEntity;
    return { id: am.id, name: member?.name ?? '', entity_type: member?.entity_type ?? '', access_right: am.access_right };
  });
  return authorizedMembers;
};

export const editAuthorizedMembers = async (context: AuthContext, user: AuthUser, workspaceId: string, input: MemberAccessInput[]) => {
  // validate input (validate access right) and remove duplicates
  const filteredInput = input.filter((value, index, array) => {
    return isValidMemberAccessRight(value.access_right) && array.findIndex((e) => e.id === value.id) === index;
  });
  if (!filteredInput.some((e) => e.access_right === MEMBER_ACCESS_RIGHT_ADMIN)) {
    throw FunctionalError('Workspace should have at least one admin');
  }
  const authorizedMembersInput = filteredInput.map((e) => {
    return { id: e.id, access_right: e.access_right };
  });
  const patch = { authorized_members: authorizedMembersInput };
  const { element } = await patchAttribute(context, user, workspaceId, ENTITY_TYPE_WORKSPACE, patch);
  return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, element, user);
};

export const getCurrentUserAccessRight = async (context: AuthContext, user: AuthUser, workspace: BasicStoreEntityWorkspace) => {
  return getUserAccessRight(user, workspace);
};

export const getOwnerId = (workspace: BasicStoreEntityWorkspace) => {
  return (Array.isArray(workspace.creator_id) && workspace.creator_id.length > 0) ? workspace.creator_id.at(0) : workspace.creator_id;
};

export const objects = async (context: AuthContext, user: AuthUser, workspaceId: string, args: WorkspaceObjectsArgs) => {
  const key = buildRefRelationKey(RELATION_HAS_REFERENCE);
  const types = args.types ?? ['Stix-Meta-Object', 'Stix-Core-Object', 'stix-relationship'];
  const filters = [{ key, values: [workspaceId] }, ...(args.filters || [])];
  const finalArgs = { ...args, filters };
  if (args.all) {
    return paginateAllThings(context, user, types, finalArgs);
  }
  return listThings(context, user, types, finalArgs);
};

export const addWorkspace = async (context: AuthContext, user: AuthUser, workspace: WorkspaceAddInput) => {
  const authorizedMembers = workspace.authorized_members ?? [];
  if (!authorizedMembers.some((e) => e.id === user.id)) {
    // add creator to authorized_members on creation
    authorizedMembers.push({ id: user.id, access_right: MEMBER_ACCESS_RIGHT_ADMIN });
  }
  const workspaceToCreate = { ...workspace, authorized_members: authorizedMembers };
  const created = await createEntity(context, user, workspaceToCreate, ENTITY_TYPE_WORKSPACE);
  return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].ADDED_TOPIC, created, user);
};

export const workspaceDelete = async (context: AuthContext, user: AuthUser, workspaceId: string) => {
  await deleteElementById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE);
  return workspaceId;
};

export const workspaceAddRelation = async (context: AuthContext, user: AuthUser, workspaceId: string, input: StixRefRelationshipAddInput) => {
  const data = await internalLoadById(context, user, workspaceId);
  if (data.entity_type !== ENTITY_TYPE_WORKSPACE || !isInternalRelationship(input.relationship_type)) {
    throw FunctionalError('Only stix-internal-relationship can be added through this method.', { workspaceId, input });
  }
  const finalInput = { ...input, fromId: workspaceId };
  return createRelation(context, user, finalInput);
};

export const workspaceAddRelations = async (context: AuthContext, user: AuthUser, workspaceId: string, input: StixRefRelationshipsAddInput) => {
  const workspace = await storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE);
  if (!workspace) {
    throw FunctionalError('Cannot add the relation, workspace cannot be found.');
  }
  if (!isInternalRelationship(input.relationship_type)) {
    throw FunctionalError(`Only ${ABSTRACT_INTERNAL_RELATIONSHIP} can be added through this method.`);
  }
  if (!input.toIds) {
    throw FunctionalError('Cannot add relations, toIds argument is not defined.');
  }
  const finalInput = input.toIds.map(
    (n) => ({ fromId: workspaceId, toId: n, relationship_type: input.relationship_type })
  );
  await createRelations(context, user, finalInput);
  return storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE).then((entity) => {
    return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, entity, user);
  });
};

export const workspaceDeleteRelation = async (context: AuthContext, user: AuthUser, workspaceId: string, toId: string, relationshipType: string) => {
  const workspace = await storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE);
  if (!workspace) {
    throw FunctionalError('Cannot delete the relation, workspace cannot be found.');
  }
  if (!isInternalRelationship(relationshipType)) {
    throw FunctionalError(`Only ${ABSTRACT_INTERNAL_RELATIONSHIP} can be deleted through this method.`);
  }
  await deleteRelationsByFromAndTo(context, user, workspaceId, toId, relationshipType, ABSTRACT_INTERNAL_RELATIONSHIP);
  return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, workspace, user);
};

export const workspaceDeleteRelations = async (context: AuthContext, user: AuthUser, workspaceId: string, toIds: string[], relationshipType: string) => {
  const workspace = await storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE);
  if (!workspace) {
    throw FunctionalError('Cannot delete the relation, workspace cannot be found.');
  }
  if (!isInternalRelationship(relationshipType)) {
    throw FunctionalError(`Only ${ABSTRACT_INTERNAL_RELATIONSHIP} can be deleted through this method.`);
  }
  for (let i = 0; i < toIds.length; i += 1) {
    await deleteRelationsByFromAndTo(context, user, workspaceId, toIds[i], relationshipType, ABSTRACT_INTERNAL_RELATIONSHIP);
  }
  return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, workspace, user);
};

export const workspaceEditField = async (context: AuthContext, user: AuthUser, workspaceId: string, input: EditInput[]) => {
  const { element } = await updateAttribute(context, user, workspaceId, ENTITY_TYPE_WORKSPACE, input);
  return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, element, user);
};

// region context
export const workspaceCleanContext = async (context: AuthContext, user: AuthUser, workspaceId: string) => {
  await delEditContext(user, workspaceId);
  return storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE).then((userToReturn) => {
    return notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, userToReturn, user);
  });
};

export const workspaceEditContext = async (context: AuthContext, user: AuthUser, workspaceId: string, input: EditContext) => {
  await setEditContext(user, workspaceId, input);
  return storeLoadById(context, user, workspaceId, ENTITY_TYPE_WORKSPACE)
    .then((workspaceToReturn) => notify(BUS_TOPICS[ENTITY_TYPE_WORKSPACE].EDIT_TOPIC, workspaceToReturn, user));
};

// endregion
