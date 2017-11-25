function Neod3Renderer() {

    var styleContents =
        "node {\
          diameter: '40px';\
          color: #DFE1E3;\
          border-color: #D4D6D7;\
          border-width: 2px;\
          text-color-internal: #000000;\
          text-color-external: #000000;\
          caption: '{name}';\
          font-size: 10px;\
        }\
        relationship {\
          color: #999;\
          shaft-width: 3px;\
          font-size: 9px;\
          padding: 3px;\
          text-color-external: #000000;\
          text-color-internal: #FFFFFF;\
        }\n";



    var serializer = null;

    var $downloadSvgLink = $('<a href="#" class="btn btn-success visualization-download" target="_blank"><i class="icon-download-alt"></i> Download SVG</a>').hide().click(function () {
        $downloadSvgLink.hide();
    });
    var downloadSvgLink = $downloadSvgLink[0];
    var blobSupport = 'Blob' in window;
    var URLSupport = 'URL' in window && 'createObjectURL' in window.URL;
    var msBlobSupport = typeof window.navigator.msSaveOrOpenBlob !== 'undefined';
    var svgStyling = '<style>\ntext{font-family:sans-serif}\n</style>';
    var stylingUrl = window.location.hostname === 'www.neo4j.org' ? 'http://gist.neo4j.org/css/neod3' : 'styles/neod3';
    stylingUrl += window.isInternetExplorer ? '-ie.css': '.css';




    function dummyFunc() {
    }

    function render(id, $container, visualization) {
        var legendStyle = {};
        function node_styles(nodes) {
            var nonPropsKey = ["id", "start", "end", "source", "target", "labels", "type", "selected","properties"];
            function getProps(node) {
                var props = {};
                for (var property in node) {
                    if (!node.hasOwnProperty(property) || nonPropsKey.indexOf(property) != -1) continue;
                    props[property] = node[property];
                }
                return props;
            }
            function lastLabel(node) {
                var labels = node["labels"];
                if (labels && labels.length) {
                    return labels[labels.length - 1];
                }
                return "";
            }

            var style = {};

            var prio_props = ["name", "title", "tag", "username", "lastname","caption"];
            for (var i = 0; i < nodes.length; i++) {
                var props= nodes[i].properties = getProps(nodes[i]);
                var keys = Object.keys(props);
                if (lastLabel(nodes[i]) !== "" && keys.length > 0) {
                    var selected_keys = prio_props.filter(function (k) {
                        return keys.indexOf(k) !== -1
                    });
                    selected_keys = selected_keys.concat(keys).concat(['id']);
                    var selector = "node." + lastLabel(nodes[i]);
                    var selectedKey = selected_keys[0];
                    if (typeof(props[selectedKey]) === "string" && props[selectedKey].length > 30) {
                        props[selectedKey] = props[selectedKey].substring(0,30)+" ...";
                    }
                    style[selector] = style[selector] || selectedKey;
                }
            }
            return style;
        }
        function styleToJson(styles, styleContents) {
            function format(key) {
                var item=styles[key];
                return item.selector +
                    " {diameter: "+item.diameter+"" +
                    ";caption: '{" + item.caption +
                    "}'; color: " + item.color +
                    "; border-color: " + item['border-color'] +
                    "; text-color-internal: " +  item['text-color-internal'] +
                    "; text-color-external: " +  item['text-color-external'] +
                    "; }"
            }
            return styleContents + Object.keys(styles).map(format).join("\n");
        }
        function addNodeStyleToExistingStyle(nodeStyle,  existingStyle) {
            var colors = neo.style.defaults.colors;
            var currentColor = 1;
            for (var selector in nodeStyle) { // node.Entity, node.Intermediary, node.Officer
                if (!(selector in existingStyle)) {
                    var color = colors[currentColor];
                    currentColor = (currentColor + 1) % colors.length;
                    var textColor = window.isInternetExplorer ? '#000000' : color['text-color-internal'];
                    var style = {selector:selector, caption:nodeStyle[selector], color:color.color,
                         "border-color":color['border-color'], "text-color-internal":textColor,"text-color-external": textColor }
                    existingStyle[selector] = style;
                }
            }
            return existingStyle;
        }
        function addNodeStyleWithSizeToExistingStyle(nodeStyle,  existingStyle, legendStyle) {
            for(var i=1; i <= 11; i++) {
                for (var s in nodeStyle) { // node.Entity, node.Intermediary, node.Officer
                    var selector = s + i;
                    if (!(selector in existingStyle)) {
                        var style = {
                            diameter: 30 + 8*i,
                            selector: selector,
                            caption: nodeStyle[s],
                            color: legendStyle[s]['color'],
                            "border-color": legendStyle[s]['border-color'],
                            "text-color-internal": legendStyle[s]['text-color-internal'],
                            "text-color-external": legendStyle[s]['text-color-external']
                        }
                        existingStyle[selector] = style;
                    }
                }
            }
            return existingStyle;
        }
        function applyZoom() {
            renderer.select(".nodes").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            renderer.select(".relationships").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }

        function enableZoomHandlers() {
            renderer.on("wheel.zoom",zoomHandlers.wheel);
            renderer.on("mousewheel.zoom",zoomHandlers.mousewheel);
            renderer.on("mousedown.zoom",zoomHandlers.mousedown);
            renderer.on("DOMMouseScroll.zoom",zoomHandlers.DOMMouseScroll);
            renderer.on("touchstart.zoom",zoomHandlers.touchstart);
            renderer.on("touchmove.zoom",zoomHandlers.touchmove);
            renderer.on("touchend.zoom",zoomHandlers.touchend);
        }

        function disableZoomHandlers() {
            renderer.on("wheel.zoom",null);
            renderer.on("mousewheel.zoom",null);
            renderer.on("mousedown.zoom", null);
            renderer.on("DOMMouseScroll.zoom", null);
            renderer.on("touchstart.zoom",null);
            renderer.on("touchmove.zoom",null);
            renderer.on("touchend.zoom",null);
        }

        function createLegendCircles(svg, styles) {
          var keys = Object.keys(styles).sort();
          var circles = svg.selectAll('circle.legend').data(keys);
          var r=20;
          circles.enter().append('circle').classed('legend', true).attr({
            cx: 2*r,
            r : r
          });
          circles.attr({
            cy: function(node) {
              return (keys.indexOf(node)+1)*2.2*r;
            },
            fill: function(node) {
              return styles[node]['color'];
            },
            stroke: function(node) {
              return styles[node]['border-color'];
            },
            'stroke-width': function(node) {
              return "2px";
            }
          });
          var text = svg.selectAll('text.legend').data(keys);
          text.enter().append('text').classed('legend',true).attr({
            'text-anchor': 'left',
            'font-weight': 'bold',
            'stroke-width' : '0',
            'stroke-color' : 'black',
            'fill' : 'black',
            'x' : 3.2*r,
            'font-size' : "12px"
          });
          text.text(function(node) {
            var label = styles[node].selector;
            return label ? label.substring(5) : "";
          }).attr('y', function(node) {
              return (keys.indexOf(node)+1)*2.2*r+6;
          })
/*
          .attr('stroke', function(node) {
            return styles[node]['color'];
          })
         .attr('fill', function(node) {
              return styles[node]['text-color-internal'];
          });
*/
          return circles.exit().remove();
        }
        function keyHandler() {
            if (d3.event.altKey) {
                enableZoomHandlers();
            }
            else if (d3.event.shiftKey){
               disableZoomHandlers();
            }
        }

        var links = visualization.links;
        var nodes = visualization.nodes;
        var outGoingCount = {};
        var incomingCount = {};
        for (var i = 0; i < links.length; i++) {
            links[i].source = links[i].start;
            links[i].target = links[i].end;
            links[i].properties = props(links[i]);

            // count the number of edges if already in the list, increment count
            outGoingCount[links[i].start] = outGoingCount[links[i].start] ? outGoingCount[links[i].start]+1 : 1;
            incomingCount[links[i].end] = incomingCount[links[i].end] ? incomingCount[links[i].end]+1 : 1;

        }
        // set property
        var max = 0;
        for (var i = 0; i < nodes.length; i++) {
            // ternary if. condition ? if true: if false. If exist, put value else 0
            nodes[i].totalEdge = outGoingCount[nodes[i].id] ? outGoingCount[nodes[i].id]: 0 + incomingCount[nodes[i].id]?incomingCount[nodes[i].id]:0;
            if(nodes[i].totalEdge > max) {
                max = nodes[i].totalEdge;
            }
        }

        // finds #graph and append a SVG
        var svg = d3.select("#" + id).append("svg");
        var nodeStyles = node_styles(nodes);

        addNodeStyleToExistingStyle(nodeStyles, legendStyle);

        // LEGEND
        createLegendCircles(svg,legendStyle);

        var hiddenStyle = {};
        var maxSize = 10;
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].diameter = Math.floor(1.0 * nodes[i].totalEdge / max * maxSize) + 1; // 1-10
            nodes[i].labels[0] = nodes[i].labels[0]+ nodes[i].diameter;
        }

        addNodeStyleWithSizeToExistingStyle(nodeStyles, hiddenStyle, legendStyle);

        var styleInJson = styleToJson(hiddenStyle, styleContents);
        var graphModel = neo.graphModel()
            .nodes(nodes)
            .relationships(links);
        var graphView = neo.graphView()
            .style(styleInJson)
            .width($container.width()).height($container.height());
    //.on('nodeClicked', dummyFunc).on('relationshipClicked', dummyFunc).on('nodeDblClicked', dummyFunc)

        var renderer = svg.data([graphModel]);
        var zoomHandlers = {};
        var zoomBehavior = d3.behavior.zoom().on("zoom", applyZoom).scaleExtent([0.2, 8]);

        renderer.call(graphView);
        renderer.call(zoomBehavior);

        zoomHandlers.wheel = renderer.on("wheel.zoom");
        zoomHandlers.mousewheel = renderer.on("mousewheel.zoom");
        zoomHandlers.mousedown = renderer.on("mousedown.zoom");
        zoomHandlers.DOMMouseScroll = renderer.on("DOMMouseScroll.zoom");
        zoomHandlers.touchstart = renderer.on("touchstart.zoom");
        zoomHandlers.touchmove = renderer.on("touchmove.zoom")
        zoomHandlers.touchend = renderer.on("touchend.zoom");
        //disableZoomHandlers();

        d3.select('body').on("keydown", keyHandler).on("keyup", keyHandler);

        function refresh() {
            graphView.height($container.height());
            graphView.width($container.width());
            renderer.call(graphView);
        }

        function saveToSvg() {
            var svgElement = $('#' + id).children('svg').first()[0];
            var xml = serializeSvg(svgElement, $container);
            if (!msBlobSupport && downloadSvgLink.href !== '#') {
                window.URL.revokeObjectURL(downloadSvgLink.href);
            }
            var blob = new window.Blob([xml], {
                'type': 'image/svg+xml'
            });
            var fileName = id + '.svg';
            if (!msBlobSupport) {
                downloadSvgLink.href = window.URL.createObjectURL(blob);
                $downloadSvgLink.appendTo($container).show();
                $downloadSvgLink.attr('download', fileName);
            } else {
                window.navigator.msSaveOrOpenBlob(blob, fileName);
            }
        }

        function getFunctions() {
            var funcs = {};
            if (blobSupport && (URLSupport || msBlobSupport)) {
                funcs['icon-download-alt'] = {'title': 'Save as SVG', 'func':saveToSvg};
            }
            return funcs;
        }

        return  {
            'subscriptions': {
                'expand': refresh,
                'contract': refresh,
                'sizeChange': refresh
            },
            'actions': getFunctions()
        };
    }

    function serializeSvg(element, $container) {
        if (serializer === null) {
            if (typeof window.XMLSerializer !== 'undefined') {
                var xmlSerializer = new XMLSerializer();
                serializer = function (emnt) {
                    return xmlSerializer.serializeToString(emnt);
                };
            } else {
                serializer = function (emnt) {
                    return '<svg xmlns="http://www.w3.org/2000/svg">' + $(emnt).html() + '</svg>';
                }
            }
        }
        var svg = serializer(element);
        svg = svg.replace('<svg ', '<svg height="' + $container.height() + '" width="' + $container.width() + '" ')
            .replace(/<g/, '\n' + svgStyling + '\n<g');
        return svg;
    }

    $.get(stylingUrl, function (data) {
        svgStyling = '<style>\n' + data + '\n</style>';
        $(svgStyling).appendTo('head');
    });

    return {'render': render};
}
