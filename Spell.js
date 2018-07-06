class Spell{
    constructor() {
        this.cooldown = 1; // 1 means you can cast it every turn
        this.cooldownRemaining = 0;
        this.requiresTarget = false;
        this.requiresDirection = false;
    }

    cast(caster, targetCell = null) {
        this.cooldownRemaining = this.cooldown;
        this.castEffect(caster, targetCell);
    }

    castEffect(caster, targetCell) {
        console.error('Must override castEffect in derivative spell class');
    }
}

const spells = {};

spells.MagicMissile = class MagicMissile extends Spell{

};

spells.SongOfFriendship = class SongOfFriendship extends Spell{

};
