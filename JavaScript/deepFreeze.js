/**
 * Recursively freezes all properties of an object.
 *
 * @param   {object} object - The object to be deeply frozen.
 * @returns {object}          The original object, with all of its properties recursively frozen.
 */
const deepFreeze = (object) =>
      Object.values(object)
                  .forEach((value) =>
                            value  && typeof value === 'object' 
                                   ? 
                 deepFreeze(value) : null) 
                                   || 
                          Object.freeze(object);