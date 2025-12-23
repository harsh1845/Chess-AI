// --- DOM Elements ---
const boardElement = document.getElementById('chessboard');
const resetBtn = document.getElementById('resetBtn');
const blackCapElement = document.getElementById('black-captures');
const whiteCapElement = document.getElementById('white-captures');
const turnIndicator = document.getElementById('turn-indicator');
const aiStatusElement = document.getElementById('ai-status');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverText = document.getElementById('game-over-text');
const newGameBtn = document.getElementById('new-game-btn');

// --- AI Configuration ---
const AI_PLAYER = 'black';
const AI_THINKING_DEPTH = 3;
let transpositionTable = {};

// --- MODEL / GAME STATE ---
let gameState = createInitialGameState();
let selectedSquare = null;
let draggedPieceInfo = null;


// ================================================================================================
// ============================= OPENING BOOK LOGIC ===============================================
// ================================================================================================

function generateFEN(state) {
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r][c];
            if (piece) {
                if (emptyCount > 0) { fen += emptyCount; emptyCount = 0; }
                let char = piece.type.charAt(0);
                if (piece.type === 'Knight') char = 'N';
                fen += (piece.color === 'white' ? char.toUpperCase() : char.toLowerCase());
            } else { emptyCount++; }
        }
        if (emptyCount > 0) { fen += emptyCount; }
        if (r < 7) { fen += '/'; }
    }
    fen += ` ${state.currentPlayer.charAt(0)}`;
    let castlingStr = '';
    if (state.castling.white.K) castlingStr += 'K';
    if (state.castling.white.Q) castlingStr += 'Q';
    if (state.castling.black.k) castlingStr += 'k';
    if (state.castling.black.q) castlingStr += 'q'; // Corrected line
    fen += ` ${castlingStr || '-'}`;
    if (state.enPassantTarget) {
        const col = String.fromCharCode('a'.charCodeAt(0) + state.enPassantTarget.col);
        const row = 8 - state.enPassantTarget.row;
        fen += ` ${col}${row}`;
    } else { fen += ' -'; }
    fen += ' 0 1';
    return fen;
}

function convertAlgebraicToMove(algebraicMove) {
    const fromCol = algebraicMove.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = 8 - parseInt(algebraicMove.charAt(1), 10);
    const toCol = algebraicMove.charCodeAt(2) - 'a'.charCodeAt(0);
    const toRow = 8 - parseInt(algebraicMove.charAt(3), 10);
    return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
}
// in script.js

function triggerAITurn() {
    boardElement.classList.add('board-disabled');
    aiStatusElement.textContent = 'AI is thinking...';

    transpositionTable = {};

    setTimeout(() => {
        const currentFEN = generateFEN(gameState);
        console.log("Looking for FEN with key:", currentFEN); // Good for debugging

        // *** THIS IS THE FIX ***
        // The book's FEN keys are simplified. They ignore the en passant square
        // and the move clocks. We must build a key that matches this format.

        const fenParts = currentFEN.split(' ');
        // Create the key from the first 4 parts: [board, player, castling, en_passant]
        const fenKey = fenParts.slice(0, 4).join(' ');

        const bookMoveAlgebraic = openingBook[fenKey];

        if (bookMoveAlgebraic) {
            console.log("AI played from Opening Book:", bookMoveAlgebraic);
            const bookMove = convertAlgebraicToMove(bookMoveAlgebraic);
            if (isMoveLegal(bookMove)) { // Final safety check
                makeMove(bookMove);
            } else {
                console.warn("Book move was illegal, falling back to Minimax.");
                const bestMove = findBestMove();
                if (bestMove) { makeMove(bestMove); }
            }
        } else {
            // If the first lookup fails, try again by ignoring the en passant square,
            // which is how your book is formatted.
            const simplerFenKey = `${fenParts[0]} ${fenParts[1]} ${fenParts[2]} -`;
            const simplerBookMove = openingBook[simplerFenKey];

            if (simplerBookMove) {
                console.log("AI played from Simplified Book Key:", simplerBookMove);
                const bookMove = convertAlgebraicToMove(simplerBookMove);
                if (isMoveLegal(bookMove)) { makeMove(bookMove); }
            } else {
                console.log("Leaving opening book, using Minimax.");
                const bestMove = findBestMove();
                if (bestMove) { makeMove(bestMove); }
            }
        }

        boardElement.classList.remove('board-disabled');
        aiStatusElement.textContent = '';
    }, 100);
}

// ================================================================================================
// ==================== ALL OTHER CODE IS BELOW (with specific fixes) =============================
// ================================================================================================

function createInitialGameState() {
    return {
        board: [
            [{ type: 'Rook', color: 'black' }, { type: 'Knight', color: 'black' }, { type: 'Bishop', color: 'black' }, { type: 'Queen', color: 'black' }, { type: 'King', color: 'black' }, { type: 'Bishop', color: 'black' }, { type: 'Knight', color: 'black' }, { type: 'Rook', color: 'black' }],
            [{ type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }, { type: 'Pawn', color: 'black' }],
            [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
            [{ type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }, { type: 'Pawn', color: 'white' }],
            [{ type: 'Rook', color: 'white' }, { type: 'Knight', color: 'white' }, { type: 'Bishop', color: 'white' }, { type: 'Queen', color: 'white' }, { type: 'King', color: 'white' }, { type: 'Bishop', color: 'white' }, { type: 'Knight', color: 'white' }, { type: 'Rook', color: 'white' }]
        ],
        currentPlayer: 'white',
        castling: {
            white: { K: true, Q: true },
            black: { k: true, q: true }
        },
        enPassantTarget: null,
        capturedPieces: { white: [], black: [] },
        isGameOver: false, 
        kingInCheck: null,
        lastMove: null 
    };
}
function isMoveLegal(move) {
    if (!move || !move.from || !move.to) return false;
    const legalMoves = getAllLegalMoves(gameState.currentPlayer, gameState);
    return legalMoves.some(
        lm => lm.from.row === move.from.row &&
            lm.from.col === move.from.col &&
            lm.to.row === move.to.row &&
            lm.to.col === move.to.col
    );
}

function handleSquareClick(row, col) {
    if (gameState.isGameOver || gameState.currentPlayer === AI_PLAYER) return;
    const piece = gameState.board[row][col];

    if (selectedSquare) {
        const move = { from: selectedSquare, to: { row, col } };
        if (isMoveLegal(move)) {
            makeMove(move);
        } else if (piece && piece.color === gameState.currentPlayer) {
            selectedSquare = { row, col };
            renderBoard();
        } else {
            selectedSquare = null;
            renderBoard();
        }
    } else {
        if (piece && piece.color === gameState.currentPlayer) {
            selectedSquare = { row, col };
            renderBoard();
        }
    }
}

function handleDragStart(e, row, col) {
    const piece = gameState.board[row][col];
    if (
        gameState.isGameOver || !piece ||
        piece.color !== gameState.currentPlayer ||
        gameState.currentPlayer === AI_PLAYER
    ) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData("text/plain", JSON.stringify({ row, col }));
    selectedSquare = null;
    draggedPieceInfo = { row, col };
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e, row, col) {
    e.preventDefault();
    if (!draggedPieceInfo) return;

    const targetSquare = e.target.closest('.square');
    document.querySelectorAll('.valid-move-hover-capture, .valid-move-hover-empty')
        .forEach(sq => sq.classList.remove('valid-move-hover-capture', 'valid-move-hover-empty'));

    const move = { from: draggedPieceInfo, to: { row, col } };
    if (isMoveLegal(move)) {
        const hasPiece = gameState.board[row][col] !== null;
        targetSquare.classList.add(hasPiece ? 'valid-move-hover-capture' : 'valid-move-hover-empty');
    }
}

function handleDragLeave(e) {
    e.target.closest('.square')?.classList.remove('valid-move-hover-capture', 'valid-move-hover-empty');
}

function handleDrop(e, row, col) {
    e.preventDefault();
    if (!draggedPieceInfo) return;

    e.target.closest('.square')?.classList.remove('valid-move-hover-capture', 'valid-move-hover-empty');
    const move = { from: draggedPieceInfo, to: { row, col } };
    if (isMoveLegal(move)) {
        makeMove(move);
    }
    draggedPieceInfo = null;
    renderBoard();
}

function makeMove(move) {
    const { from, to } = move;
    const pieceToMove = gameState.board[from.row][from.col];

    // Castling
    if (pieceToMove.type === 'King' && Math.abs(from.col - to.col) === 2) {
        if (to.col === 6) {
            const rook = gameState.board[from.row][7];
            gameState.board[from.row][5] = rook;
            gameState.board[from.row][7] = null;
        } else {
            const rook = gameState.board[from.row][0];
            gameState.board[from.row][3] = rook;
            gameState.board[from.row][0] = null;
        }
    }

    // Capture
    const capturedPiece = gameState.board[to.row][to.col];
    if (capturedPiece) {
        gameState.capturedPieces[capturedPiece.color].push(capturedPiece);
    }

    // Move the piece
    gameState.board[to.row][to.col] = pieceToMove;
    gameState.board[from.row][from.col] = null;

    // Pawn promotion
    if (pieceToMove.type === 'Pawn' && (to.row === 0 || to.row === 7)) {
        gameState.board[to.row][to.col] = { type: 'Queen', color: pieceToMove.color };
    }

    // En passant tracking
    if (pieceToMove.type === 'Pawn' && Math.abs(from.row - to.row) === 2) {
        gameState.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    } else {
        gameState.enPassantTarget = null;
    }

    // Castling rights
    const playerColor = pieceToMove.color;
    if (pieceToMove.type === 'King') {
        gameState.castling[playerColor].K = false;
        gameState.castling[playerColor].Q = false;
    }
    if (pieceToMove.type === 'Rook') {
        const startRow = playerColor === 'white' ? 7 : 0;
        if (from.row === startRow && from.col === 0) {
            gameState.castling[playerColor].Q = false;
        }
        if (from.row === startRow && from.col === 7) {
            gameState.castling[playerColor].K = false;
        }
    }

    gameState.lastMove = move;
    // Switch turn
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
    selectedSquare = null;
    draggedPieceInfo = null;
    updateGameStatus();
    renderBoard();

    if (!gameState.isGameOver && gameState.currentPlayer === AI_PLAYER) {
        triggerAITurn();
    }
}

function findKing(color, state) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r][c];
            if (piece && piece.type === 'King' && piece.color === color) {
                return { row: r, col: c };
            }
        }
    }
    return null;
}

function isSquareAttacked(position, attackerColor, state) {
    const allOpponentMoves = _getAllPossibleMoves(attackerColor, state, true);
    return allOpponentMoves.some(
        move => move.to.row === position.row && move.to.col === position.col
    );
}

function getPieceMoves(row, col, state, forAttackCheck = false) {
    const piece = state.board[row][col];
    if (!piece) return [];

    const moves = [];
    const directions = {
        Rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
        Bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        Knight: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
        King: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    };

    if (piece.type === 'Rook' || piece.type === 'Bishop' || piece.type === 'Queen') {
        const pieceDirs = piece.type === 'Queen'
            ? [...directions.Rook, ...directions.Bishop]
            : directions[piece.type];

        for (const [dr, dc] of pieceDirs) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;

                const targetPiece = state.board[newRow][newCol];
                if (targetPiece) {
                    if (targetPiece.color !== piece.color) {
                        moves.push({ from: { row, col }, to: { row: newRow, col: newCol } });
                    }
                    break;
                }
                moves.push({ from: { row, col }, to: { row: newRow, col: newCol } });
            }
        }

    } else if (piece.type === 'Pawn') {
        const forward = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        if (state.board[row + forward] && !state.board[row + forward][col]) {
            moves.push({ from: { row, col }, to: { row: row + forward, col: col } });

            if (
                row === startRow &&
                state.board[row + 2 * forward] &&
                !state.board[row + 2 * forward][col]
            ) {
                moves.push({ from: { row, col }, to: { row: row + 2 * forward, col: col } });
            }
        }

        for (let dc of [-1, 1]) {
            if (
                col + dc >= 0 &&
                col + dc <= 7 &&
                state.board[row + forward]
            ) {
                const target = state.board[row + forward][col + dc];
                if (target && target.color !== piece.color) {
                    moves.push({
                        from: { row, col },
                        to: { row: row + forward, col: col + dc }
                    });
                }
            }
        }

    } else if (piece.type === 'Knight') {
        for (const [dr, dc] of directions.Knight) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
                const targetPiece = state.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ from: { row, col }, to: { row: newRow, col: newCol } });
                }
            }
        }

    } else if (piece.type === 'King') {
        for (const [dr, dc] of directions.King) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
                const targetPiece = state.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ from: { row, col }, to: { row: newRow, col: newCol } });
                }
            }
        }

        if (!forAttackCheck) {
            const playerColor = piece.color;
            const opponentColor = playerColor === 'white' ? 'black' : 'white';
            const rights = state.castling[playerColor];
            const canCastleK = playerColor === 'white' ? rights.K : rights.k;
            const canCastleQ = playerColor === 'white' ? rights.Q : rights.q;

            if (canCastleK || canCastleQ) {
                if (!isSquareAttacked({ row, col }, opponentColor, state)) {
                    if (
                        canCastleK &&
                        !state.board[row][col + 1] &&
                        !state.board[row][col + 2] &&
                        !isSquareAttacked({ row, col: col + 1 }, opponentColor, state) &&
                        !isSquareAttacked({ row, col: col + 2 }, opponentColor, state)
                    ) {
                        moves.push({ from: { row, col }, to: { row, col: col + 2 } });
                    }

                    if (
                        canCastleQ &&
                        !state.board[row][col - 1] &&
                        !state.board[row][col - 2] &&
                        !state.board[row][col - 3] &&
                        !isSquareAttacked({ row, col: col - 1 }, opponentColor, state) &&
                        !isSquareAttacked({ row, col: col - 2 }, opponentColor, state)
                    ) {
                        moves.push({ from: { row, col }, to: { row, col: col - 2 } });
                    }
                }
            }
        }
    }

    return moves;
}

function _getAllPossibleMoves(playerColor, state, forAttackCheck = false) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r][c];
            if (piece && piece.color === playerColor) {
                moves.push(...getPieceMoves(r, c, state, forAttackCheck));
            }
        }
    }
    return moves;
}

function _getCaptureMoves(playerColor, state) {
    const captureMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r][c];
            if (piece && piece.color === playerColor) {
                const pieceMoves = getPieceMoves(r, c, state, true); // Use 'true' to disable special moves
                for (const move of pieceMoves) {
                    // A move is a capture if there is a piece on the destination square.
                    if (state.board[move.to.row][move.to.col] !== null) {
                        captureMoves.push(move);
                    }
                }
            }
        }
    }
    return captureMoves;
}

function getAllLegalMoves(playerColor, state) {
    const pseudoLegalMoves = _getAllPossibleMoves(playerColor, state, false);
    const legalMoves = [];
    const opponentColor = playerColor === 'white' ? 'black' : 'white';

    for (const move of pseudoLegalMoves) {
        const tempState = fastClone(state);
        const piece = tempState.board[move.from.row][move.from.col];
        tempState.board[move.to.row][move.to.col] = piece;
        tempState.board[move.from.row][move.from.col] = null;

        if (piece.type === 'King' && Math.abs(move.from.col - move.to.col) === 2) {
            if (move.to.col === 6) {
                tempState.board[move.from.row][5] = tempState.board[move.from.row][7];
                tempState.board[move.from.row][7] = null;
            } else {
                tempState.board[move.from.row][3] = tempState.board[move.from.row][0];
                tempState.board[move.from.row][0] = null;
            }
        }

        const kingPos = findKing(playerColor, tempState);
        if (kingPos && !isSquareAttacked(kingPos, opponentColor, tempState)) {
            const opponentKingPos = findKing(opponentColor, tempState);
            if (opponentKingPos && isSquareAttacked(opponentKingPos, playerColor, tempState)) {
                move.isCheck = true; // *** ADD THIS LINE ***
            }
            legalMoves.push(move);
        }
    }
    return legalMoves;
}


function updateGameStatus() {
    gameState.kingInCheck = null;
    const opponentColor = gameState.currentPlayer === 'white' ? 'black' : 'white';
    const kingPos = findKing(gameState.currentPlayer, gameState);

    if (kingPos && isSquareAttacked(kingPos, opponentColor, gameState)) {
        gameState.kingInCheck = gameState.currentPlayer;
    }

    const legalMoves = getAllLegalMoves(gameState.currentPlayer, gameState);
    if (legalMoves.length === 0) {
        gameState.isGameOver = true;
        let message = "";

        if (gameState.kingInCheck) {
            message = `Checkmate!<br>${opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)} wins!`;
        } else {
            message = `Stalemate!<br>It's a draw.`;
        }

        gameOverText.innerHTML = message;
        gameOverOverlay.style.display = 'flex';
        turnIndicator.style.display = 'none';
    }
}

const pieceValues = {
    'Pawn': 100,
    'Knight': 300,
    'Bishop': 300,
    'Rook': 500,
    'Queen': 900,
    'King': 9000
};

const pieceSquareTables = {
    'Pawn': [
        [  0,   0,   0,   0,   0,   0,   0,   0],
        [ 50,  50,  50,  50,  50,  50,  50,  50],
        [ 10,  10,  20,  30,  30,  20,  10,  10],
        [  5,   5,  10,  27,  27,  10,   5,   5],
        [  0,   0,   0,  25,  25,   0,   0,   0],
        [  5,  -5, -10,   0,   0, -10,  -5,   5],
        [  5,  10,  10, -25, -25,  10,  10,   5],
        [  0,   0,   0,   0,   0,   0,   0,   0]
    ],
    'Knight': [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20,   0,   0,   0,   0, -20, -40],
        [-30,   0,  10,  15,  15,  10,   0, -30],
        [-30,   5,  15,  20,  20,  15,   5, -30],
        [-30,   0,  15,  20,  20,  15,   0, -30],
        [-30,   5,  10,  15,  15,  10,   5, -30],
        [-40, -20,   0,   5,   5,   0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    'Bishop': [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10,   0,   0,   0,   0,   0,   0, -10],
        [-10,   0,   5,  10,  10,   5,   0, -10],
        [-10,   5,   5,  10,  10,   5,   5, -10],
        [-10,   0,  10,  10,  10,  10,   0, -10],
        [-10,  10,  10,  10,  10,  10,  10, -10],
        [-10,   5,   0,   0,   0,   0,   5, -10],
        [-20, -10, -40, -10, -10, -40, -10, -20]
    ]
};

function evaluateBoard(board) {
    let totalScore = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                let value = pieceValues[piece.type] || 0;
                
                // Add positional bonus from Piece-Square Tables
                const pst = pieceSquareTables[piece.type];
                if (pst) {
                    // For black, we flip the row index to read the table from their perspective
                    const pstRow = piece.color === 'white' ? row : 7 - row;
                    value += pst[pstRow][col];
                }
                
                totalScore += (piece.color === 'white' ? value : -value);
            }
        }
    }
    return totalScore;
}
function minimax(state, depth, alpha, beta, isMaximizingPlayer) {
    // 1. Base case: Quiescence Search (Pass 0 as initial Q-depth)
    if (depth === 0) {
        return quiescenceSearch(state, alpha, beta, isMaximizingPlayer, 0);
    }

    // 2. Transposition Table Lookup
    const fenKey = generateSimpleKey(state);
    const tableEntry = transpositionTable[fenKey];

    if (tableEntry && tableEntry.depth >= depth) {
        if (tableEntry.flag === 'EXACT') {
            return tableEntry.value;
        }
        if (tableEntry.flag === 'LOWERBOUND') {
            alpha = Math.max(alpha, tableEntry.value);
        } else if (tableEntry.flag === 'UPPERBOUND') {
            beta = Math.min(beta, tableEntry.value);
        }
        if (alpha >= beta) {
            return tableEntry.value;
        }
    }

    const legalMoves = getAllLegalMoves(state.currentPlayer, state);

    // 3. Move Ordering
    legalMoves.sort((a, b) => {
        const pieceA = state.board[a.to.row][a.to.col];
        const pieceB = state.board[b.to.row][b.to.col];
        const scoreA = pieceA ? (pieceValues[pieceA.type] || 0) : 0;
        const scoreB = pieceB ? (pieceValues[pieceB.type] || 0) : 0;
        return scoreB - scoreA;
    });

    if (legalMoves.length === 0) {
        const kingPos = findKing(state.currentPlayer, state);
        const oppColor = state.currentPlayer === 'white' ? 'black' : 'white';
        if (kingPos && isSquareAttacked(kingPos, oppColor, state)) {
            return isMaximizingPlayer ? -Infinity : Infinity;
        }
        return 0; // Stalemate
    }

    const originalAlpha = alpha;

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of legalMoves) {
            const tempState = applyMoveToState(state, move);
            // FIX: Renamed variable 'eval' to 'evaluation'
            const evaluation = minimax(tempState, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        
        let flag = 'EXACT';
        if (maxEval <= originalAlpha) flag = 'UPPERBOUND';
        else if (maxEval >= beta) flag = 'LOWERBOUND';
        
        transpositionTable[fenKey] = { value: maxEval, depth: depth, flag: flag };
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of legalMoves) {
            const tempState = applyMoveToState(state, move);
            // FIX: Renamed variable 'eval' to 'evaluation'
            const evaluation = minimax(tempState, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        
        let flag = 'EXACT';
        if (minEval <= alpha) flag = 'UPPERBOUND';
        else if (minEval >= beta) flag = 'LOWERBOUND';
        
        transpositionTable[fenKey] = { value: minEval, depth: depth, flag: flag };
        return minEval;
    }
}

function quiescenceSearch(state, alpha, beta, isMaximizingPlayer, depth) {
    const stand_pat = evaluateBoard(state.board);
    
    // 1. Check Hard Depth Limit
    if (depth > 7) return stand_pat;

    if (isMaximizingPlayer) {
        if (stand_pat >= beta) return beta; // Stand-pat pruning
        if (stand_pat > alpha) alpha = stand_pat;
    } else {
        if (stand_pat <= alpha) return alpha; // Stand-pat pruning
        if (stand_pat < beta) beta = stand_pat;
    }

    // 2. Get only interesting moves (Captures and Checks)
    // Since we use getAllLegalMoves, these are GUARANTEED legal. 
    // We don't need manual legality checks or JSON.parse inside the loop.
    const nonQuietMoves = getAllLegalMoves(state.currentPlayer, state).filter(move => {
        const isCapture = state.board[move.to.row][move.to.col] !== null;
        return isCapture || move.isCheck;
    });

    // 3. Sort by MVV-LVA (Crucial for performance)
    nonQuietMoves.sort((a, b) => {
        const pieceA = state.board[a.to.row][a.to.col];
        const pieceB = state.board[b.to.row][b.to.col];
        const scoreA = pieceA ? (pieceValues[pieceA.type] || 0) : 0;
        const scoreB = pieceB ? (pieceValues[pieceB.type] || 0) : 0;
        return scoreB - scoreA;
    });

    // 4. Single Loop
    for (const move of nonQuietMoves) {
        const tempState = applyMoveToState(state, move);
        const score = quiescenceSearch(tempState, alpha, beta, !isMaximizingPlayer, depth + 1);

        if (isMaximizingPlayer) {
            if (score >= beta) return beta; // Beta Cutoff
            if (score > alpha) alpha = score;
        } else {
            if (score <= alpha) return alpha; // Alpha Cutoff
            if (score < beta) beta = score;
        }
    }

    return isMaximizingPlayer ? alpha : beta;
}

function fastClone(state) {
    // 1. Create a new board array (faster than mapping)
    const newBoard = new Array(8);
    for (let r = 0; r < 8; r++) {
        newBoard[r] = new Array(8);
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            // Shallow copy the piece object is enough if you don't mutate pieces directly
            newBoard[r][c] = p ? { type: p.type, color: p.color } : null; 
        }
    }

    // 2. Return the new state object manually
    return {
        board: newBoard,
        currentPlayer: state.currentPlayer,
        castling: {
            white: { K: state.castling.white.K, Q: state.castling.white.Q },
            black: { k: state.castling.black.k, q: state.castling.black.q }
        },
        enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
        // AI logic rarely needs the full history of captured pieces, just the board values
        capturedPieces: { white: [], black: [] }, 
        isGameOver: state.isGameOver,
        kingInCheck: state.kingInCheck,
        lastMove: state.lastMove
    };
}

function applyMoveToState(state, move) {
    const newState = fastClone(state);
    const piece = newState.board[move.from.row][move.from.col];
    newState.board[move.to.row][move.to.col] = piece;
    newState.board[move.from.row][move.from.col] = null;

    const playerColor = piece.color;
    if (piece.type === 'King') {
        if (playerColor === 'white') { newState.castling.white.K = false; newState.castling.white.Q = false; }
        else { newState.castling.black.k = false; newState.castling.black.q = false; }
    }
    if (piece.type === 'Rook') {
        const startRow = (playerColor === 'white' ? 7 : 0);
        if (move.from.row === startRow && move.from.col === 0) {
            if (playerColor === 'white') newState.castling.white.Q = false;
            else newState.castling.black.q = false;
        }
        if (move.from.row === startRow && move.from.col === 7) {
            if (playerColor === 'white') newState.castling.white.K = false;
            else newState.castling.black.k = false;
        }
    }
    newState.currentPlayer = newState.currentPlayer === 'white' ? 'black' : 'white'; return newState;
}

function generateSimpleKey(state) {
    let key = "";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (p) {
                // e.g., "wK" (White King), "bP" (Black Pawn) + position index
                key += `${p.color[0]}${p.type[0]}${r}${c}`;
            }
        }
    }
    return key + state.currentPlayer + 
           state.castling.white.K + state.castling.white.Q + 
           state.castling.black.k + state.castling.black.q;
}

function findBestMove() {

    const legalMoves = getAllLegalMoves(AI_PLAYER, gameState).sort(() => 0.5 - Math.random());

    if (legalMoves.length === 0) {
        return null;
    }

    let bestMove = legalMoves[0];
    let bestValue = Infinity;

    for (const move of legalMoves) {
        const tempState = applyMoveToState(gameState, move);
        const boardValue = minimax(tempState, AI_THINKING_DEPTH - 1, -Infinity, Infinity, true);
        if (boardValue < bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }
    return bestMove;
}

function renderBoard() {
    boardElement.innerHTML = '';
     // *** ADD THIS BLOCK right before the main for-loop starts ***
    const lastMove = gameState.lastMove;
    let lastPlayerColor = null;
    if (lastMove) {
        // When renderBoard runs, currentPlayer has already been switched.
        // So, the player who made the last move is the OPPOSITE of the current player.
        lastPlayerColor = gameState.currentPlayer === 'white' ? 'black' : 'white';
    }
    // *** END OF NEW BLOCK ***
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div'); 
            square.classList.add('square', (row + col) % 2 === 0 ? 'white' : 'black');
            square.dataset.row = row; 
            square.dataset.col = col;
            if (lastMove) {
                if (row === lastMove.from.row && col === lastMove.from.col) {
                    square.classList.add(`last-move-highlight-${lastPlayerColor}-from`);
                }
                if (row === lastMove.to.row && col === lastMove.to.col) {
                    square.classList.add(`last-move-highlight-${lastPlayerColor}-to`);
                }
            }
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) { 
                square.classList.add('selected-highlight'); 
            }
            const piece = gameState.board[row][col];
            if (piece) {
                const pieceImg = document.createElement('img'); pieceImg.src = `assets/${piece.color.charAt(0).toUpperCase() + piece.color.slice(1)}_${piece.type}.png`; pieceImg.classList.add('piece'); pieceImg.draggable = true;
                pieceImg.addEventListener('dragstart', (e) => handleDragStart(e, row, col)); pieceImg.addEventListener('dragend', handleDragEnd); square.appendChild(pieceImg);
            }
            if (gameState.kingInCheck && piece && piece.type === 'King' && piece.color === gameState.kingInCheck) { 
                square.classList.add('in-check'); 
            }
            square.addEventListener('click', () => handleSquareClick(row, col)); 
            square.addEventListener('dragover', handleDragOver); 
            square.addEventListener('dragenter', (e) => handleDragEnter(e, row, col)); 
            square.addEventListener('dragleave', handleDragLeave); 
            square.addEventListener('drop', (e) => handleDrop(e, row, col));
            boardElement.appendChild(square);
        }
    }
    if (!gameState.isGameOver) { turnIndicator.textContent = `${gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1)}'s Turn` + (gameState.kingInCheck ? ' (In Check)' : ''); }
    whiteCapElement.innerHTML = '<h3>White Captures</h3>'; blackCapElement.innerHTML = '<h3>Black Captures</h3>';
    gameState.capturedPieces.white.forEach(p => { const img = document.createElement('img'); img.src = `assets/White_${p.type}.png`; img.classList.add('piece'); blackCapElement.appendChild(img); });
    gameState.capturedPieces.black.forEach(p => { const img = document.createElement('img'); img.src = `assets/Black_${p.type}.png`; img.classList.add('piece'); whiteCapElement.appendChild(img); });
}
resetBtn.addEventListener('click', () => window.location.reload());
newGameBtn.addEventListener('click', () => window.location.reload());
renderBoard();
