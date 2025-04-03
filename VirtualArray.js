/**
 * VirtualArray class creates a proxy that combines multiple arrays or other VirtualArrays to behave as a single array.
 *
 * @class
 * @example
 * const virtualArray = new VirtualArray([1, 2, 3], [4, 5, 6]);
 * console.log(virtualArray.length); // Output: 6
 */
class VirtualArray
{ /**
   * Constructor for the VirtualArray class.
   *
   * @param {...Array} arrays - The arrays to be combined into the virtual array.
   */
  constructor(...arrays)
  { this.arrays = arrays;
    return this.createProxy();
  }

  /**
   * Creates a new proxy object for the combined arrays.
   * @method
   * @returns {Proxy} - The proxy object of the combined arrays.
   */
  createProxy()
  { // Define the proxy handlers
    return new Proxy(this.arrays,
      { // Define the getter
        get: (target, prop) =>
          { // If the property is a symbol, return the corresponding value
           if (typeof prop === 'symbol') 
              return target[prop];

            // If the property is 'length', calculate and return the combined length of all arrays
            if (prop === 'length')
              return target.reduce((acc, arr) => acc + arr.length, 0);

            // If the property is the iterator symbol, return a generator function that iterates over all arrays
            if (prop === Symbol.iterator)
            { let [index, subIndex] = [0, 0];
              // Return a generator function
              return function* ()
              { // As long as index is less than the length of the target (the combined arrays)
                while (index < target.length)
                { // Output a pair consisting of the current array's index and the element at the 'subIndex' position within that specific array.
                  yield [index, target[index][subIndex]];
                  subIndex++;
                  // If subIndex is equal to or greater than the length of the current array...
                  if (subIndex >= target[index].length)
                  // Increment index to move to the next array,
                  // and reset the subIndex for the next array
                  { index++; subIndex = 0; }
                }
              };
            }

            // List of methods that operate on the flattened array
            if (
              [ 'flat',        'entries',
                'push',        'unshift',
                'filter',      'map',
                'forEach',     'reduce',
                'slice',       'splice',
                'flatMap',     'getArray',
                'pushToArray', 'unshiftToArray',
                'flattenOrPassthrough'
              ].includes(prop)
            ) 
            { return (...args) =>
              { // For 'push' and 'unshift', operate on the last array
                if (['push', 'unshift'].includes(prop))
                  return target[target.length - 1][prop](...args);

                // For methods that operate on a specific array, retrieve the array and perform the operation
                if (['getArray', 'pushToArray', 'unshiftToArray'].includes(prop))
                { const [index, ...rest] = args;
                  if (prop === 'getArray')
                    return target[index];
                  return target[index][prop.replace('ToArray', '')](...rest);
                }

                // For all other methods, create a flattened copy of the arrays and perform the operation
                const arr = [];
                target.forEach((subArr) => arr.push(...subArr));
                return arr[prop](...args);
              };
            }

            // For 'pop' and 'shift', operate on the last or first array, respectively, and remove it if it becomes empty
            if (['pop', 'shift'].includes(prop))
            { return () =>
              { const index  = prop === 'pop'
                                     ?
                   target.length - 1 : 0;
                const result = target[index][prop]();
                // remove the array from the VirtualArray if it is empty
                if (!target[index].length)
                  target.splice(index, 1);
                return result;
              };
            }

            // If the property is a number, return the corresponding element from the combined arrays
            let index = parseInt(prop, 10);
            if (Number.isNaN(index)) 
              return undefined;

            for (const arr of target)
            { if (arr.length > index) 
                return arr[index];
              index -= arr.length;
            }
          },

           // Define the setter
          set: (target, prop, value) =>
          { let index = parseInt(prop, 10);
            if (Number.isNaN(index)) 
              return false;

            // If the property is a number, set the corresponding element in the combined arrays
            for (const arr of target)
            { // If the current array is long enough to contain the index...
              if (arr.length > index)
              { // Set the index-th element of the array to the new value
                arr[index] = value;
                // Return true, indicating that the set operation succeeded
                return true;
              }
              // If the current array isn't long enough, subtract its length from the index and move on to the next array
              index -= arr.length;
            // If none of the arrays are long enough to contain the index, return false to indicate that the set operation failed
            } return false;
          },
      });
  }
}