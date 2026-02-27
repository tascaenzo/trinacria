import { factoryProvider, type Token } from "@trinacria/core";
import { type Model, type Schema } from "mongoose";
import { MONGOOSE_SERVICE, type MongooseService } from "./mongoose.service";

export function createMongooseSchemaProvider<
  TEntity,
  TModel extends Model<TEntity>,
>(token: Token<TModel>, schemaName: string, schema: Schema<TEntity>) {
  return factoryProvider(
    token,
    (mongooseService: MongooseService) => {
      const connection = mongooseService.getConnection();
      return ((connection.models[schemaName] as TModel | undefined) ??
        connection.model<TEntity>(schemaName, schema)) as TModel;
    },
    [MONGOOSE_SERVICE],
  );
}
