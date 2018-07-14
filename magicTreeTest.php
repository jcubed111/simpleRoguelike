<head>
    <style>
        @import url('https://fonts.googleapis.com/css?family=Inconsolata:400,700');

        body{
            font-family: 'Inconsolata', monospace;
            background: #222226;
            margin: 10px 15px;
        }

        #desc{
            font-size: 20px;
            white-space: pre;
            color: #c22;
        }

        .decoration{ color: #666; }
        .bold{ color: #6e8be5; }
        .title{ color: #eee; }
        .number{ color: #32b089; }
        .regular{ color: #8b8b8b; }
        .regular{ color: #8b8b8b; }
        .error{ color: #e22; }

        a{
            color: inherit;
            /*text-decoration: underline;*/
            cursor: pointer;
        }

        a:hover .number{ color:#6e8be5; }
    </style>
    <script>
        function classify(text, wrapMark = 40, blockIndent = 0) {
            wrapMark -= blockIndent;
            const blockIndentPadding = " ".repeat(blockIndent);
            if(text == '') return blockIndentPadding;
            const classNames = {
                d: 'decoration',
                b: 'bold',
                t: 'title',
                n: 'number',
                r: 'regular',
                c: 'color', // format: %c{#123456}
            };
            return text.trimEnd().split('\n').map(line => {
                let resultLength = 0;
                let lastSpanStart = "<span class='regular'>";
                let result = blockIndentPadding + lastSpanStart;
                let indent = line.search(/[^ \-]/);
                for(let i=0; i < line.length; i++) {
                    let l = line[i];
                    switch(l) {
                        case '%':
                            const next = line[++i];
                            if(next == 'c') {
                                const color = line.substr(i).match(/\{(#[0-9a-fA-F]+)\}/)[1];
                                lastSpanStart = "<span class='"+classNames.c+"' style='color: "+color+";'>"
                                result += "</span>" + lastSpanStart;
                                i += color.length + 2;
                            }else if(next == 'l') {
                                const linkInfo = line.substr(i).match(/\{(.+?)\}/)[1];
                                result += '</span><a data-linkInfo="' + linkInfo + '">' + lastSpanStart;
                                i += linkInfo.length + 2;
                            }else if(next == 'e') {
                                result += "</span></a>" + lastSpanStart;
                            }else{
                                let className = classNames[next] || 'error';
                                lastSpanStart = "<span class='"+className+"'>"
                                result += "</span>" + lastSpanStart;
                            }
                            break;
                        case ' ':
                            if(resultLength < wrapMark) result += l;
                            resultLength++;
                            break;
                        default:
                            let part = '';
                            let j;
                            for(j=i; j < line.length; j++) {
                                if(line[j] == ' ' || line[j] == '%') break;
                                if(line[j] == '\\') j++;
                                part += line[j];
                            }
                            i = j - 1;

                            while(resultLength + part.length > wrapMark) {
                                // wrap
                                while(part.length > wrapMark - indent) {
                                    if(resultLength > indent) {
                                        result += '\n' + blockIndentPadding;
                                        result += " ".repeat(indent);
                                    }
                                    result += part.substr(0, wrapMark - indent);
                                    resultLength = wrapMark;
                                    part = part.substr(wrapMark - indent);
                                }
                                resultLength = indent;
                                result += '\n' + blockIndentPadding;
                                result += " ".repeat(indent);
                            }
                            result += part;
                            resultLength += part.length;
                            break;
                    }
                }
                return result + "</span>";
            }).join('\n');
        }
    </script>
    <script src="parseTree.js"></script>
</head>
<body>
    <div id="desc"></div>
    <script>
        const source = `<?=file_get_contents("magicTree.txt")?>`;
        let p = new TreeParser();
        let tree = p.parse(source);
        tree.nodeMap.magicMissile1.learned = true;
        tree.nodeMap.tameAnimal.learned = true;
        function render() {
            document.getElementById('desc').innerHTML = classify(tree.toString(true), 1000);
        }
        render();

        document.getElementById('desc').addEventListener('click', e => {
            let target = e.target;
            while(target && target.tagName != 'A') {
                target = target.parentNode;
                if(target.id == 'desc') return;
            }
            tree.nodeMap[target.dataset.linkinfo].learned = !tree.nodeMap[target.dataset.linkinfo].learned;
            render();
        });
    </script>
</body>
