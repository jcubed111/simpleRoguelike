let edges = [];

function addEdge(dx, dy, side) {
    let p0, p1, pc;
    switch(side) {
        case 's':
            p0 = {x: dx - 0.5, y: dy - 0.5};
            p1 = {x: dx + 0.5, y: dy - 0.5};
            pc = {x: dx      , y: dy - 0.5};
            break;
        case 'n':
            p0 = {x: dx - 0.5, y: dy + 0.5};
            p1 = {x: dx + 0.5, y: dy + 0.5};
            pc = {x: dx      , y: dy + 0.5};
            break;
        case 'w':
            p0 = {x: dx - 0.5, y: dy + 0.5};
            p1 = {x: dx - 0.5, y: dy - 0.5};
            pc = {x: dx - 0.5, y: dy      };
            break;
        case 'e':
            p0 = {x: dx + 0.5, y: dy + 0.5};
            p1 = {x: dx + 0.5, y: dy - 0.5};
            pc = {x: dx + 0.5, y: dy      };
            break;
    }

    const atans = [p0, p1].map(p => Math.atan2(p.y, p.x));

    const newEdge = {
        dx: dx,
        dy: dy,
        side: side,
        minAngle: Math.min(...atans),
        maxAngle: Math.max(...atans),
        dist2: pc.x*pc.x + pc.y*pc.y,
    };

    edges.push(newEdge);
}

for(let dx = -10; dx < 11; dx++) {
    for(let dy = -10; dy < 11; dy++) {
        if(dx <= 0 && dy == 0) continue; // skip the points along the -x axis cause atan2 will return incorrect ranges
        if(dy > 0) addEdge(dx, dy, 's');
        if(dy < 0) addEdge(dx, dy, 'n');
        if(dx > 0) addEdge(dx, dy, 'w');
        if(dx < 0) addEdge(dx, dy, 'e');
    }
}

// go back and cover the points along the -x axis
for(let dx = -10; dx < 0; dx++) {
    let dy = 0;
    // we push twice cause we need to cover the range covering -pi and the range covering +pi
    edges.push({
        dx: dx,
        dy: 0,
        side: 'e',
        minAngle: Math.atan2(0.5, dx + 0.5),
        maxAngle: Math.atan2(-0.5, dx + 0.5) + Math.PI*2,
        dist2: Math.pow(dx + 0.5, 2),
    });
    edges.push({
        dx: dx,
        dy: 0,
        side: 'e',
        minAngle: Math.atan2(0.5, dx + 0.5) - Math.PI*2,
        maxAngle: Math.atan2(-0.5, dx + 0.5),
        dist2: Math.pow(dx + 0.5, 2),
    });
}

// sort the edges by dist2
edges.sort((a, b) => a.dist2 - b.dist2);

// export to json
console.log(JSON.stringify(edges));
