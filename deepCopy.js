import VirtualArray from './VirtualArray';

/**
 * deepCopy function creates a deep copy of the given object.
 *
 * @param   {*} obj - The object to be copied.
 * @returns {*}     - The deep copy of the object.
 * @example
 * const original = { a: 1, b: [1, 2, 3], c: { d: 4 } };
 * const copy     = deepCopy(original);
 * console.log(copy); 
 *          Output: { a: 1, b: [1, 2, 3], c: { d: 4 } }
 */
function deepCopy(obj) {
  // If the object is null, not an object, or a function, return it as is
  if (obj === null || typeof obj !== 'object' || obj instanceof Function)
                             return obj;

  if (obj instanceof Date)   return new Date(obj);

  if (obj instanceof RegExp) return new RegExp(obj);

  if (obj instanceof Map)    return new Map(deepCopy([...obj]));

  if (obj instanceof Set)    return new Set(deepCopy([...obj]));

  // If the object is a VirtualArray, return a new VirtualArray with a deep copy of the arrays
  if (obj instanceof VirtualArray)
    return new VirtualArray(...obj.arrays.map(deepCopy));

  // Initialize the copy as an empty array if the object is an array, or an empty object
  const copy = Array.isArray(obj) ? [] : {};

  // Iterate over each own property of the object
  for (const key in obj)
    if (obj.hasOwnProperty(key))
      // Set the corresponding property in the copy to a deep copy of the property in the object
      copy[key] = deepCopy(obj[key]);
  // Return the deep copy
  return copy;
}
