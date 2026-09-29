const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ==========================================
// 遊戲狀態與實體設定
// ==========================================
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const difficultyContainer = document.getElementById('difficultyContainer');
const btnEasy = document.getElementById('btnEasy');
const btnMedium = document.getElementById('btnMedium');
const btnHard = document.getElementById('btnHard');


let gameTime = 0;
let timerInterval = null;
let fallSpeed = 3;
let currentDifficulty = 'normal';
let hasStarted = false;
let score = 0;
let isGameOver = false;
let isPaused = false;
let animationId = null;

const player = {
    x: 225,
    y: 520,
    width: 85,
    height: 85,
    speed: 6,
    dx: 0
};

let enemies = [];
let items = [];

pauseBtn.addEventListener('click', () => {
    if (!hasStarted) return;
    if (isGameOver) return;

    if (isPaused) {
        isPaused = false;
        pauseBtn.innerText = '暫停遊戲';
        pauseBtn.style.backgroundColor = 'transparent';
        update();
    } else {
        isPaused = true;
        pauseBtn.innerText = '繼續遊戲';
        pauseBtn.style.backgroundColor = '#4c5c96';
    }
});

restartBtn.addEventListener('click', () => {
    cancelAnimationFrame(animationId);
    if (timerInterval) clearInterval(timerInterval);

    hasStarted = false;
    isGameOver = false;
    isPaused = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawInitialScreen();

    difficultyContainer.style.display = 'block';
});

function startGame(speed, difficultyName) {
    fallSpeed = speed;
    currentDifficulty = difficultyName;
    hasStarted = true;
    difficultyContainer.style.display = 'none';

    if (timerInterval) clearInterval(timerInterval);
    gameTime = 0;

    timerInterval = setInterval(() => {
        if (!isPaused && !isGameOver) {
            gameTime++;
        }
    }, 1000);

    score = 0;
    isGameOver = false;
    isPaused = false;
    pauseBtn.innerText = '暫停遊戲';
    pauseBtn.style.backgroundColor = '';
    pauseBtn.style.color = '';
    enemies = [];
    items = [];
    player.x = 225;
    player.dx = 0;

    saveGameSettings(difficultyName);

    cancelAnimationFrame(animationId);
    update();
}

btnEasy.addEventListener('click', () => startGame(3, 'easy'));
btnMedium.addEventListener('click', () => startGame(5, 'normal'));
btnHard.addEventListener('click', () => startGame(8, 'hard'));

// ==========================================
//  載入圖片資源 (路徑已更新為 Final 的目錄結構)
// ==========================================
const imgPlayer = new Image();
imgPlayer.src = '/game/image/student.png';

const imgExam = new Image();
imgExam.src = '/game/image/0-point_exam_paper.png';

const imgBook = new Image();
imgBook.src = '/game/image/book.png';

const imgGameConsole = new Image();
imgGameConsole.src = '/game/image/game.png';

// ==========================================
//  輸入控制 (鍵盤左右鍵)
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') player.dx = -player.speed;
    else if (e.key === 'ArrowRight') player.dx = player.speed;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') player.dx = 0;
});

// ==========================================
//  繪製與更新邏輯
// ==========================================

function checkCollision(obj1, obj2, padding) {
    return (
        obj1.x + padding < obj2.x + obj2.width - padding &&
        obj1.x + obj1.width - padding > obj2.x + padding &&
        obj1.y + padding < obj2.y + obj2.height - padding &&
        obj1.y + obj1.height - padding > obj2.y + padding
    );
}

function drawPlayer() {
    ctx.drawImage(imgPlayer, player.x, player.y, player.width, player.height);
}

function spawnEntities() {
    if (Math.random() < 0.03) {
        enemies.push({
            x: Math.random() * (canvas.width - 60),
            y: -60,
            width: 60,
            height: 60,
            speed: fallSpeed
        });
    }

    let itemChance = Math.random();
    if (itemChance < 0.015) {
        let isBook = Math.random() > 0.5;
        items.push({
            x: Math.random() * (canvas.width - 40),
            y: -40,
            width: 40,
            height: 40,
            speed: fallSpeed,
            type: isBook ? 'book' : 'game'
        });
    }
}

function updateAndDrawEntities() {
    for (let i = 0; i < enemies.length; i++) {
        let enemy = enemies[i];
        enemy.y += enemy.speed;

        ctx.drawImage(imgExam, enemy.x, enemy.y, enemy.width, enemy.height);

        if (checkCollision(player, enemy, 15)) {
            isGameOver = true;
        }

        if (enemy.y > canvas.height) {
            enemies.splice(i, 1);
            i--;
        }
    }

    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        item.y += item.speed;

        if (item.type === 'book') {
            ctx.drawImage(imgBook, item.x, item.y, item.width, item.height);
        } else {
            ctx.drawImage(imgGameConsole, item.x, item.y, item.width, item.height);
        }

        if (checkCollision(player, item, 10)) {
            if (item.type === 'book') {
                score += 5;
            } else if (item.type === 'game') {
                score += 2;
            }
            items.splice(i, 1);
            i--;
        } else if (item.y > canvas.height) {
            items.splice(i, 1);
            i--;
        }
    }
}

function drawScore() {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 20px "Source Sans Pro", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Survival Score: ' + score, 15, 30);
}

function drawTimer() {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 20px "Source Sans Pro", Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Time: ' + gameTime + ' 秒', canvas.width - 15, 30);
}

// ==========================================
//  遊戲主迴圈 (Game Loop)
// ==========================================
function update() {
    if (isGameOver) {
        clearInterval(timerInterval);
        saveGameSession();

        ctx.fillStyle = 'rgba(46, 49, 65, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px "Raleway", Arial';
        ctx.fillText('拿到0分！被當了！', canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = '20px "Source Sans Pro", Arial';
        ctx.fillText('最終分數: ' + score, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('生存時間: ' + gameTime + ' 秒', canvas.width / 2, canvas.height / 2 + 50);
        return;
    }

    if (isPaused) {
        ctx.fillStyle = 'rgba(46, 49, 65, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 35px "Raleway", Arial';
        ctx.fillText('|| 遊戲暫停中', canvas.width / 2, canvas.height / 2);

        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.x += player.dx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    drawPlayer();
    spawnEntities();
    updateAndDrawEntities();
    drawScore();
    drawTimer();
    animationId = requestAnimationFrame(update);
}

function drawInitialScreen() {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "Raleway", Arial';
    ctx.fillText('請在上方選擇難度以開始遊戲', canvas.width / 2, canvas.height / 2);
}

window.onload = () => {
    drawInitialScreen();
};

// --- 儲存遊戲設定 (POST /api/game/settings) ---
async function saveGameSettings(difficulty) {
    const settingData = {
        user_id: "system",
        difficulty_default: difficulty,
        updated_at: new Date().toISOString()
    };

    try {
        await fetch('/api/game/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingData)
        });
        console.log("設定已發送至後端", settingData);
    } catch (error) {
        console.error("儲存設定失敗:", error);
    }
}

// --- 儲存遊戲結果 (POST /api/game/sessions) ---
async function saveGameSession() {
    const sessionId = "g_" + Math.random().toString(36).substr(2, 9);

    const sessionData = {
        session_id: sessionId,
        user_id: "system",
        difficulty: currentDifficulty,
        score: score,
        duration_sec: gameTime,
        ended_at: new Date().toISOString()
    };

    try {
        await fetch('/api/game/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        console.log("遊戲結果已發送至後端", sessionData);
    } catch (error) {
        console.error("儲存結果失敗:", error);
    }
}
