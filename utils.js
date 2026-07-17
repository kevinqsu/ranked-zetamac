const DIFFICULTY_RANGES = {
    easy:   { add: [2, 60],  sub: [2, 60],  mult1: [2, 12], mult2: [2, 20] },
    medium: { add: [2, 100], sub: [2, 100], mult1: [2, 12], mult2: [2, 100] },
    hard:   { add: [2, 300], sub: [2, 300], mult1: [2, 20], mult2: [2, 200] }
};

function generate_question(difficulty) {
    const r = DIFFICULTY_RANGES[difficulty] || DIFFICULTY_RANGES.medium;
    const choice = getRandomInt(0, 3);

    if (choice === 0) {
        // addition
        const a = getRandomInt(r.add[0], r.add[1]);
        const b = getRandomInt(r.add[0], r.add[1]);
        return a + " + " + b;
    } else if (choice === 1) {
        // subtraction (reverse addition, so answers are always positive)
        const a = getRandomInt(r.sub[0], r.sub[1]);
        const b = getRandomInt(r.sub[0], r.sub[1]);
        return (a + b) + " - " + a;
    } else if (choice === 2) {
        // multiplication
        const a = getRandomInt(r.mult1[0], r.mult1[1]);
        const b = getRandomInt(r.mult2[0], r.mult2[1]);
        return a + " * " + b;
    }
    // division (reverse multiplication, so answers are always whole)
    const a = getRandomInt(r.mult1[0], r.mult1[1]);
    const b = getRandomInt(r.mult2[0], r.mult2[1]);
    return (a * b) + " / " + a;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = function() {
    this.generate_questions = function generate_questions(count, difficulty) {
        let questions = [];
        for (let i = 0; i < count; i++) {
            questions.push(generate_question(difficulty));
        }
        return questions;
    };
};
