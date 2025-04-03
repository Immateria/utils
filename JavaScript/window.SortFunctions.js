/** * A collection of utility functions for sorting arrays of objects based on various criteria. * @namespace SortFunctions */
window.SortFunctions =
{  /**
    * Retrieves the value at the specified dot-separated path from the given object.
    * 
    * @memberof  SortFunctions
    * @param    {Object} obj  - The object to retrieve the value from.
    * @param    {string} path - The dot-separated path to the nested field.
    * @returns  {*}             The value at the specified path, or undefined if not found.
    * @private
    */
    _getNestedValue(obj, path)
    { const keys = path.split('.');
      return keys.reduce(
        (nestedObj,   key) => (nestedObj && nestedObj[key] !== undefined)
          ? nestedObj[key]
          : undefined,
            obj
      );
    },

    /** 
     * Resolves values for comparison based on the provided fieldName or returns direct values if fieldName is undefined.
     * Adjusts to handle field names for both 'a' and 'b' when fieldName is an object with custom functions or values,
     * or a dot-separated string indicating a path to a nested value.
     * 
     * @param   {Object}        a                - The first item to compare.
     * @param   {Object}        b                - The second item to compare.
     * @param   {string|Object} fieldName        - The field name to compare on, or an object containing 'a' and 'b' keys for custom values.
     * @param   {*}            [defaultValue=''] - The default value to use if the field is not found or is undefined.
     * @returns {{aValue: *, bValue: *}}           An object containing the resolved values for 'a' and 'b'.
     * @private
     */
    _resolveValues(a, b, fieldName, defaultValue = '')
    { if (typeof fieldName === 'undefined')
        return { aValue: a, bValue: b };

      if (typeof fieldName === 'string')
        return { aValue: window.SortFunctions._getNestedValue(a, fieldName, defaultValue), 
                 bValue: window.SortFunctions._getNestedValue(b, fieldName, defaultValue) 
               };
               
      if (typeof fieldName === 'object'  &&  fieldName !== null)
      { return {     aValue: fieldName.a !==  undefined
                                          ? 
                    ( typeof fieldName.a === 'function'
                                          ? 
                                      fieldName.a(a)
                                          : 
                      this._resolveValues(a, null, fieldName.a, defaultValue).aValue
                    )                     : 
                                      defaultValue,

                     bValue: fieldName.b !== undefined
                                          ? 
                    ( typeof fieldName.b === 'function'
                                          ? 
                                      fieldName.b(b)
                                          : 
                       this._resolveValues(b, null, fieldName.b, defaultValue).bValue
                    )                     : 
                                      defaultValue
                };
      } return { aValue: defaultValue, bValue: defaultValue };
    },

    /**
     * Creates a function for ascending alphabetical sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    alphabeticalAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        console.info(`aValue: ${aValue},\nbValue: ${bValue},\nfieldName: ${fieldName}`);
        return aValue?.toString()?.localeCompare(bValue?.toString());
      };
    },

    /**
     * Creates a function for descending alphabetical sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    alphabeticalDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        console.info(`aValue: ${aValue},\nbValue: ${bValue},\nfieldName: ${fieldName}`);
        return bValue?.toString()?.localeCompare(aValue?.toString());
      };
    },

    /**
     * Creates a function for ascending numerical sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    numericalAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        return  Number(aValue) - Number(bValue);
      };
    },

    /**
     * Creates a function for descending numerical sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    numericalDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        return  Number(bValue) - Number(aValue);
      };
    },

    /**
     * Creates a function for ascending date sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    dateAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue,  bValue} = resolve(a, b, fieldName);
        return new Date(aValue) - new Date(bValue);
      };
    },

    /**
     * Creates a function for descending date sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    dateDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue,  bValue} = resolve(a, b, fieldName);
        return new Date(bValue) - new Date(aValue);
      };
    },

    /**
     * Creates a function for ascending sorting of an array of objects based on the length of a specific string field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    lengthAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        return aValue.length - bValue.length;
      };
    },

    /**
     * Creates a function for descending sorting of an array of objects based on the length of a specific string field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    lengthDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue, bValue} = resolve(a, b, fieldName);
        return bValue.length - aValue.length;
      };
    },

    /**
     * Creates a function for ascending sorting of an array of objects based on the value of a nested field.
     * 
     * @memberof  SortFunctions
     * @param    {string} fieldPath - The dot-separated path to the nested field by which to sort.
     * @returns  {Function}           A sorting function that can be passed directly to Array.sort.
     */
    nestedFieldAsc(fieldPath)
    { return(a, b) =>
      { const aValue =  window.SortFunctions._getNestedValue(a, fieldPath);
        const bValue =  window.SortFunctions._getNestedValue(b, fieldPath);
        return aValue.toString().localeCompare(bValue.toString());
      };
    },

    /**
     * Creates a function for descending sorting of an array of objects based on the value of a nested field.
     * 
     * @memberof  SortFunctions
     * @param    {string} fieldPath - The dot-separated path to the nested field by which to sort.
     * @returns  {Function}           A sorting function that can be passed directly to Array.sort.
     */
    nestedFieldDesc(fieldPath)
    { return(a, b) =>
      { const  aValue =  window.SortFunctions._getNestedValue(a, fieldPath);
        const  bValue =  window.SortFunctions._getNestedValue(b, fieldPath);
        return bValue.toString().localeCompare(aValue.toString());
      };
    },

    /**
     * Creates a function for ascending sorting of an array of objects based on the result of a custom getter function.
     * 
     * @memberof  SortFunctions
     * @param    {Function} getterFn - The custom getter function that takes an object and returns a value by which to sort.
     * @returns  {Function}            A sorting function that can be passed directly to Array.sort.
     */
    getterAsc(getterFn)
    { return(a, b) =>
      { const  aValue = getterFn(a);
        const  bValue = getterFn(b);
        return aValue.toString().localeCompare(bValue.toString());
      };
    },

    /**
     * Creates a function for descending sorting of an array of objects based on the result of a custom getter function.
     * 
     * @memberof  SortFunctions
     * @param    {Function} getterFn - The custom getter function that takes an object and returns a value by which to sort.
     * @returns  {Function}            A sorting function that can be passed directly to Array.sort.
     */
    getterDesc(getterFn)
    { return(a, b) =>
      { const  aValue = getterFn(a);
        const  bValue = getterFn(b);
        return bValue.toString().localeCompare(aValue.toString());
      };
    },

    /**
     * Creates a function for ascending sorting of an array of objects based on a boolean field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    booleanAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue,    bValue} = resolve(a, b, fieldName);
        return(aValue === bValue)
          ? 0
          : (aValue
              ?  1
              : -1
            );
      };
    },

    /**
     * Creates a function for descending sorting of an array of objects based on a boolean field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    booleanDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const {aValue,    bValue} = resolve(a, b, fieldName);
        return(aValue === bValue)
          ? 0
          : (aValue
              ? -1
              :  1
            );
      };
    },

    /**
     * Creates a function for ascending sorting of an array of objects based on a custom comparison function.
     * 
     * @memberof  SortFunctions
     * @param    {Function} compareFn - The custom comparison function that takes two objects and returns a number indicating their relative order.
     * @returns  {Function}             A sorting function that can be passed directly to Array.sort.
     */
    customAsc(compareFn) { return(a, b) => compareFn(a, b); },

    /**
     * Creates a function for descending sorting of an array of objects based on a custom comparison function.
     * 
     * @memberof  SortFunctions
     * @param    {Function} compareFn - The custom comparison function that takes two objects and returns a number indicating their relative order.
     * @returns  {Function}             A sorting function that can be passed directly to Array.sort.
     */
    customDesc(compareFn) { return(a, b) => compareFn(b, a); },

    /**
     * Creates a function for random sorting of an array of objects.
     * 
     * @memberof  SortFunctions
     * @returns  {Function}            A sorting function that can be passed directly to Array.sort.
     */
    random() { return() => Math.random() - 0.5; },

    /**
     * Creates a function for ascending percentage sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    percentageAsc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const  {aValue,   bValue} = resolve(a, b, fieldName);
        return parseFloat(aValue) - parseFloat(bValue);
      };
    },

    /**
     * Creates a function for descending percentage sorting of an array of objects based on a specific field or direct values.
     * 
     * @memberof  SortFunctions
     * @param    {string|Object} fieldName - The field name by which to sort, or an object with 'a' and 'b' keys for custom value extraction.
     * @returns  {Function}                  A sorting function that can be passed directly to Array.sort.
     */
    percentageDesc(fieldName)
    { const resolve = this._resolveValues;
      return(a, b) =>
      { const  {aValue,   bValue} = resolve(a, b, fieldName);
        return parseFloat(bValue) - parseFloat(aValue);
      };
    },

    /**
     * Creates a function for sorting an array of objects based on multiple sorting predicates in order of precedence.
     * 
     * @memberof  SortFunctions
     * @param    {...Function} predicates - The sorting predicates to apply in order of precedence.
     * @returns  {Function}                 A sorting function that can be passed directly to Array.sort.
     */
    withMultipleSorts(...predicates)
    { return(a, b) =>
      { for (const predicate of predicates)
        { const result = predicate(a, b);
          if (result !== 0) 
            return result;
        } return 0;
      };
    }
  }