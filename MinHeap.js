class MinHeap{
    constructor() {
        this.elements = [];
        this.length = 0;
    }

    push(value, priority) {
        this.elements.push({
            value: value,
            key: priority
        });

        let current = this.length;
        while(current != 0) {
            const parent = current >> 1;
            if(this.elements[current].key < this.elements[parent].key) {
                this.swap(current, parent);
                current = parent;
            }else{
                break;
            }
        }

        this.length++;
    }

    swap(a, b) {
        const temp = this.elements[a];
        this.elements[a] = this.elements[b];
        this.elements[b] = temp;
    }

    pop() {
        if(this.length == 0) return undefined;

        if(this.length == 1) {
            this.length--;
            return this.elements.pop().value;
        }

        const result = this.elements[0];
        this.elements[0] = this.elements.pop();
        this.length--;

        if(this.length == 0) return result.value;

        const fixHeap = i => {
            const l = (i << 1) + 1;
            const r = (i << 1) + 2;
            let smallest = -1;
            if(r < this.length) {
                smallest = this.elements[r].key < this.elements[l].key ? r : l;
            }else if(l < this.length) {
                smallest = l;
            }else{
                return;
            }
            // swap i and smallest
            this.swap(i, smallest);
            fixHeap(smallest);
        };
        fixHeap(0);

        return result.value;
    }
}
