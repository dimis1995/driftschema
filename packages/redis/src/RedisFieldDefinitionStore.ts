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

  private allKey() {
    return "fielddef:all";
  }

  async add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition> {
    const withId: FieldDefinition = { ...def, id: crypto.randomUUID() };
    await this.client.set(this.key(withId.id), JSON.stringify(withId));
    await this.client.sAdd(this.byEntityTypeKey(def.entityType), withId.id);
    await this.client.sAdd(this.allKey(), withId.id);
    return withId;
  }

  async getByEntityType(entityType: string): Promise<FieldDefinition[]> {
    const ids = await this.client.sMembers(this.byEntityTypeKey(entityType));
    return this.getByIds(ids);
  }

  async getAll(): Promise<FieldDefinition[]> {
    const ids = await this.client.sMembers(this.allKey());
    return this.getByIds(ids);
  }

  async upsert(def: FieldDefinition): Promise<FieldDefinition> {
    const existing = await this.getRaw(def.id);

    await this.client.set(this.key(def.id), JSON.stringify(def));
    await this.client.sAdd(this.allKey(), def.id);
    await this.client.sAdd(this.byEntityTypeKey(def.entityType), def.id);
    if (existing !== undefined && existing.entityType !== def.entityType) {
      await this.client.sRem(this.byEntityTypeKey(existing.entityType), def.id);
    }

    return def;
  }

  async delete(id: string) {
    const def = await this.getRaw(id);
    if (def === undefined) return;

    await this.client.del(this.key(id));
    await this.client.sRem(this.byEntityTypeKey(def.entityType), id);
    await this.client.sRem(this.allKey(), id);
  }

  private async getRaw(id: string): Promise<FieldDefinition | undefined> {
    const raw = await this.client.get(this.key(id));
    return raw === null ? undefined : (JSON.parse(raw) as FieldDefinition);
  }

  private async getByIds(ids: string[]): Promise<FieldDefinition[]> {
    if (ids.length === 0) return [];

    const raw = await this.client.mGet(ids.map((id) => this.key(id)));
    return raw.filter((value): value is string => value !== null).map((value) => JSON.parse(value));
  }
}
