import { FieldDefinition, FieldDefinitionStore } from "driftschema";
import type { RedisClientType } from "redis";

export class RedisFieldDefinitionStore implements FieldDefinitionStore {
  constructor(private readonly client: RedisClientType) {}

  private key(id: string) {
    return `fielddef:${id}`;
  }

  private byEntityTypeKey(entityType: string) {
    return `fielddef:byEntityType:${entityType}`;
  }

  async add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition> {
    const withId: FieldDefinition = { ...def, id: crypto.randomUUID() };
    await this.client.set(this.key(withId.id), JSON.stringify(withId));
    await this.client.sAdd(this.byEntityTypeKey(def.entityType), withId.id);
    return withId;
  }

  async getByEntityType(entityType: string): Promise<FieldDefinition[]> {
    const ids = await this.client.sMembers(this.byEntityTypeKey(entityType));
    if (ids.length === 0) return [];

    const raw = await this.client.mGet(ids.map((id) => this.key(id)));
    return raw.filter((value): value is string => value !== null).map((value) => JSON.parse(value));
  }

  async delete(id: string) {
    const raw = await this.client.get(this.key(id));
    if (raw === null) return;

    const def = JSON.parse(raw) as FieldDefinition;
    await this.client.del(this.key(id));
    await this.client.sRem(this.byEntityTypeKey(def.entityType), id);
  }
}
