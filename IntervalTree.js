class Interval{
    constructor(min ,max) {
        this.min = min;
        this.max = max;
    }
}

class IntervalTree{
    // not actually a tree lol
    constructor() {
        this.intervals = []; // sorted list of non-overlapping intervals
    }

    insert(min, max) {
        // insert an interval from min to max

        // index of the first interval we need to merge with
        const firstIndex = _.sortedIndexBy(this.intervals, {max: min - 1e-10}, i => i.max);

        // index of the last interval we need to merge with
        const lastIndex = _.sortedIndexBy(this.intervals, {min: max + 1e-10}, i => i.min) - 1;

        if(firstIndex > lastIndex) {
            // just insert, then return
            this.intervals.splice(firstIndex, 0, new Interval(min, max));
            return;
        }

        const firstInterval = this.intervals[firstIndex];
        const lastInterval = this.intervals[lastIndex];

        this.intervals.splice(firstIndex, lastIndex - firstIndex + 1, new Interval(
            Math.min(min, firstInterval.min),
            Math.max(max, lastInterval.max)
        ));
    }

    contains(min, max) {
        // returns whether the current intervals contain all of (min, max)
        // aka whether there is a single interval which contains this new one
        const firstIndex = _.sortedIndexBy(this.intervals, {min: min + 1e-10}, i => i.min); // how many mins are before my min

        if(firstIndex == 0) return false; // new min is the lowest min

        return this.intervals[firstIndex-1].max + 1e-10 > max;
    }
}
