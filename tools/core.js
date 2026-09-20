// Lädt den Simulationskern direkt aus swingby.html, damit Solver, Tests und
// Spiel garantiert denselben Code benutzen.
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'swingby.html');

function load(){
  const h = fs.readFileSync(HTML, 'utf8');
  const c = h.split('/*<<CORE>>*/')[1].split('/*<</CORE>>*/')[0];
  const m = new Function(c + `
    prepLevels();
    return {LEVELS,DT,VMAX,THRUST_A,R_OUT,GOAL_R,CP_R,MIN_POW,
            makeWorld,step,launch,accel,bpos,goalPos,runSolution,preview,prepLevels};`)();
  return m;
}
module.exports = { load, HTML };
