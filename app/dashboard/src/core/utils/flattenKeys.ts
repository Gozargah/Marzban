import _ from "lodash-es";

type R = Record<string, string | number | null>;
export type NestedObj = Record<string, string | number | null | R>;

export function flattenObject(object: NestedObj) {
  const result: R = {};

  function flatten(obj: NestedObj, prefix = "") {
    _.forEach(obj, (value, key) => {
      if (_.isObject(value)) {
        flatten(value, `${prefix}${key}.`);
      } else {
        result[`${prefix}${key}`] = value;
      }
    });
  }

  flatten(object);

  return result;
}
