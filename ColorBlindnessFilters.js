(function()
{   // Inject SVG filters into the DOM
    function injectSVGFilters()
    {   // Check if the SVG filters are already injected
        if (document.getElementById('color-blindness-filters')) return;

        // Define the SVG namespace, then make the SVG
        const svgNS = "http://www.w3.org/2000/svg";
        const svg   = document.createElementNS(svgNS, 'svg'                  );
        svg.setAttribute('id',    'color-blindness-filters'                  );
        svg.setAttribute('xmlns',  svgNS                                     );
        svg.setAttribute('style', 'position: absolute; width: 0; height: 0;' );

        // Create a <defs> element to hold the filters
        const defs = document.createElementNS(svgNS, 'defs');
        svg.appendChild(defs);

        // Define the filters with their respective color matrices
        const filters =
        [   {   id: 'protanopia-filter',
                // Protanopia (Red-Blind)
                values: '0.567,   0.433,  0,     0, 0 ' +
                        '0.558,   0.442,  0,     0, 0 ' +
                        '0,       0.242,  0.758, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            },
            {   id: 'deuteranopia-filter',
                // Deuteranopia (Green-Blind)
                values: '0.625,   0.375,  0,     0, 0 ' +
                        '0.7,     0.3,    0,     0, 0 ' +
                        '0,       0.3,    0.7,   0, 0 ' +
                        '0,       0,      0,     1, 0'
            },
            {   id: 'tritanopia-filter',
                // Tritanopia (Blue-Blind)
                values: '0.95,    0.05,   0,     0, 0 ' +
                        '0,       0.433,  0.567, 0, 0 ' +
                        '0,       0.475,  0.525, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            }, 
            {   id: 'achromatopsia-filter',
                // Achromatopsia (Total Color Blindness - Grayscale)
                values: '0.299,   0.587,  0.114, 0, 0 ' +
                        '0.299,   0.587,  0.114, 0, 0 ' +
                        '0.299,   0.587,  0.114, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            },
            {   id: 'protanomaly-filter',
                // Protanomaly (Red-Weak)
                values: '0.817,   0.183,  0,     0, 0 ' +
                        '0.333,   0.667,  0,     0, 0 ' +
                        '0,       0.125,  0.875, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            },
            {   id: 'deuteranomaly-filter',
                // Deuteranomaly (Green-Weak)
                values: '0.8,     0.2,    0,     0, 0 ' +
                        '0.258,   0.742,  0,     0, 0 ' +
                        '0,       0.142,  0.858, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            },
            {   id: 'tritanomaly-filter',
                // Tritanomaly (Blue-Weak)
                values: '0.967,   0.033,  0,     0, 0 ' +
                        '0,       0.733,  0.267, 0, 0 ' +
                        '0,       0.183,  0.817, 0, 0 ' +
                        '0,       0,      0,     1, 0'
            }
        ];

        // Create and append each filter to the <defs>
        filters.forEach(filter =>
        {   const f = document.createElementNS(svgNS, 'filter');
            f.setAttribute('id', filter.id);
            
            const cm = document.createElementNS(svgNS, 'feColorMatrix');
            cm.setAttribute('type',  'matrix');
            cm.setAttribute('values', filter.values);
            
               f.appendChild(cm);
            defs.appendChild(f);
        });

        // Append the SVG to the document body
        document.body.appendChild(svg);
    }

    // Apply the selected color blindness filter
    function applyColorBlindnessFilter(type)
    {   // Inject the SVG filters if not already present
        injectSVGFilters();

        // Reference to the <body> element
        const body        = document.body;

        // Remove any existing color blindness filter
        body.style.filter = '';

        // Normalize type input (aliases)
        
        type = typeAliases[type.toLowerCase()] || type.toLowerCase();

        // Determine which filter to apply based on the type
        let filterUrl = '';
        switch(type)
        {   case 'protanopia':
                filterUrl = 'url(#protanopia-filter)';
                break;
            case 'deuteranopia':
                filterUrl = 'url(#deuteranopia-filter)';
                break;
            case 'tritanopia':
                filterUrl = 'url(#tritanopia-filter)';
                break;
            case 'achromatopsia':
                filterUrl = 'url(#achromatopsia-filter)';
                break;
            case 'protanomaly':
                filterUrl = 'url(#protanomaly-filter)';
                break;
            case 'deuteranomaly':
                filterUrl = 'url(#deuteranomaly-filter)';
                break;
            case 'tritanomaly':
                filterUrl = 'url(#tritanomaly-filter)';
                break;
            
            default:
                console.error('Invalid color blindness type. Available types: protanopia, deuteranopia, tritanopia, achromatopsia, protanomaly, deuteranomaly, tritanomaly, or their aliases.');
                return;
        }

        // Apply the selected filter to the <body>
        body.style.filter = filterUrl;
    }

    // Remove any applied color blindness filter
    function removeColorBlindnessFilter()
    { document.body.style.filter = ''; }

    // Switch between filters (remove one, apply another)
    function switchColorBlindnessFilter(applyType)
    {   removeColorBlindnessFilter();
        applyColorBlindnessFilter(applyType);
    }

    const typeAliases = {};
    const aliasGroups =
    {      protanopia: [ 'prot',        'prota',        'proto',        'protan',       
                         'red-blind',   'red blind',    'red',          'no red',
                         'r'
                       ],
         deuteranopia: [ 'deuter',      'deut',         'green-blind',  'green blind',  
                         'green',       'no green',     'g'                           
                       ],
           tritanopia: [ 'trit',        'tritan',       'blue-blind',   'blue blind',
                         'no blue',     'blue',         'b'
                       ],
        achromatopsia: [ 'achroma',     'all',          'complete',     'grayscale',
                         'greyscale',   'grey',         'gray',         'a'
                       ],
          protanomaly: [ 'red-weak',    'red weak',     'weak red',     'weak-red',
                         'rw',          'wr'
                       ],
        deuteranomaly: [ 'green-weak',  'green weak',   'weak green',   'weak-green',
                         'gw',          'wg'
                       ],
          tritanomaly: [ 'blue-weak',   'blue weak',    'weak blue',    'weak-blue',
                         'bw',          'wb'
                       ]
    };
    
    // Dynamically build the typeAliases object
    Object.entries(aliasGroups)
          .forEach(([type, aliases]) =>
          {    aliases.forEach( alias =>
                                { typeAliases[alias] = type; }
                              );
          });
    
    // Expose the functions to the global scope for easy usage
    window.ColorBlindnessSimulator =
    {     apply:  applyColorBlindnessFilter,
         remove: removeColorBlindnessFilter,
         switch: switchColorBlindnessFilter,
        options: () =>
            {   const tableData = [];
                // Create an array of objects with alias and type
                Object.keys( typeAliases )
                      .forEach( ( alias ) =>
                                    { tableData.push({ Alias: alias,
                                                        Type: typeAliases[alias] 
                                                    }); 
                                    }
                              );
        
                // Log the data as a table
                console.table(tableData);
            }
    };

})();
