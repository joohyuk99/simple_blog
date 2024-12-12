const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'mysecret';

// 간단 DB 클래스 (메모리 유지)
class DB {
    constructor() {
        this.users = [];      // {id, username, password}
        this.posts = [];      // {id, title, content, author}
        this.comments = [];   // {id, postId, author, content}
        this.userId = 1;
        this.postId = 1;
        this.commentId = 1;
    }

    addUser(username, password) {
        // 비밀번호 해싱 생략 (실서비스 시 bcrypt 사용)
        const user = { id: this.userId++, username, password };
        this.users.push(user);
        return user;
    }

    findUserByUsername(username) {
        return this.users.find(u => u.username === username);
    }

    addPost(title, content, author) {
        const post = { id: this.postId++, title, content, author };
        this.posts.push(post);
        return post;
    }

    getAllPosts() {
        return this.posts;
    }

    getPostById(id) {
        return this.posts.find(p => p.id === id);
    }

    addComment(postId, author, content) {
        const comment = { id: this.commentId++, postId, author, content };
        this.comments.push(comment);
        return comment;
    }

    getCommentsByPostId(postId) {
        return this.comments.filter(c => c.postId === postId);
    }
}

const db = new DB();

app.set('view engine', 'ejs');
app.set('views', './views')
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// JWT 인증 미들웨어
function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        req.user = null;
        return next();
    }
}

// 모든 요청에 대해 사용자 정보 주입
app.use(authMiddleware);

// 메인 페이지 (포스트 목록)
app.get('/', (req, res) => {
    const posts = db.getAllPosts();
    res.render('index', { user: req.user, posts });
});

// 회원가입
app.get('/signup', (req, res) => {
    res.render('signup', { user: req.user });
});

app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send('username, password required');
    if (db.findUserByUsername(username)) return res.send('user already exists');
    db.addUser(username, password);
    res.redirect('/login');
});

// 로그인
app.get('/login', (req, res) => {
    res.render('login', { user: req.user });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.findUserByUsername(username);
    if (!user) return res.send('user not found');
    if (user.password !== password) return res.send('password incorrect');
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/');
});

// 로그아웃
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// 게시글 작성
app.get('/posts/create', (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('post_create', { user: req.user });
});

app.post('/posts/create', (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { title, content } = req.body;
    if (!title || !content) return res.send('title, content required');
    db.addPost(title, content, req.user.username);
    res.redirect('/');
});

// 게시글 읽기
app.get('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    const post = db.getPostById(postId);
    if (!post) return res.send('post not found');
    const comments = db.getCommentsByPostId(postId);
    res.render('post_detail', { user: req.user, post, comments });
});

// 댓글 작성
app.post('/posts/:id/comment', (req, res) => {
    if (!req.user) return res.redirect('/login');
    const postId = parseInt(req.params.id);
    const post = db.getPostById(postId);
    if (!post) return res.send('post not found');
    const { content } = req.body;
    if (!content) return res.send('content required');
    db.addComment(postId, req.user.username, content);
    res.redirect('/posts/' + postId);
});

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
