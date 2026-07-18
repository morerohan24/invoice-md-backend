/**
 * Applies a consistent toJSON transform to a schema so the API keeps
 * returning `id` (string) instead of Mongo's `_id` (ObjectId) / `__v`.
 * This is what lets the frontend (written against the old JSON-file store)
 * keep working unchanged after the move to MongoDB.
 */
function applyIdTransform(schema) {
  schema.set("toJSON", {
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      return ret;
    }
  });
  schema.set("toObject", {
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      return ret;
    }
  });
}

module.exports = { applyIdTransform };
