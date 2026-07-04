import { type HydratedDocument, type Model, Schema } from "mongoose";

export interface UserEntity {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserEntity>;
export type UserSchemaModel = Model<UserEntity>;

const userSchema = new Schema<UserEntity>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true });
export { userSchema };
