const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const app = express();
const port = 8080;
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
// app.use('/css', express.static(__dirname + '/css'));

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('database.db', { readonly: false });

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        password TEXT NOT NULL,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        birthday TEXT NOT NULL
    );
`);

// One row per post — makes it easy to fetch all posts across all users
db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        author TEXT NOT NULL,
        image TEXT,
        createdAt INTEGER NOT NULL
    );
`);

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/welcome', upload.single('uploaded_file'), (req, res) => {

    let username = req.body['username'];
    let password = req.body['password'];

    if (username == '' || password == '') {
        res.send("You must fill out all fields to create a profile or log in!")
        return;
    }

    let from = req.get('Referrer');

    if (from.includes('register')) {
        let name = req.body['name'];
        let birthday = req.body['birthday'];

        if (name == '' || birthday == '') {
            res.send("You must fill out all fields to create a profile!")
            return;
        }

        db.prepare('INSERT INTO users (username, password, name, birthday) VALUES (?, ?, ?, ?)').run(username, password, name, birthday,);

    } else if (from.includes('welcome')) {

        if (!req.body['post'] || req.body['post'] == '') {
            res.send("Please include a text caption in your post!")
            return;
        }

        let newPost = req.body['post'];
        let image = req.file ? req.file.filename : null;
        let now = new Date().getTime();
        let dayInMs = 24 * 60 * 60 * 1000;

        // Check if user has posted in the last 24 hours
        let lastPost = db.prepare('SELECT createdAt FROM posts WHERE author = ? ORDER BY createdAt DESC LIMIT 1').get(username);

        if (lastPost && (now - lastPost.createdAt) < dayInMs) {
            res.send("You can only post once per day!");
            return;
        }

        // Insert post as its own row
        db.prepare('INSERT INTO posts (text, author, image, createdAt) VALUES (?, ?, ?, ?)').run(newPost, username, image, now);
    }

    let currentUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!currentUser) {
        res.send("User not found. Please register first.")
        return;
    }

    if (currentUser.password !== password) {
        res.send("Wrong password, try again!")
        return;
    }

    // Fetch ALL posts from all users, newest first
    let posts = db.prepare('SELECT * FROM posts ORDER BY createdAt DESC').all();

    res.render('welcome', {
        'user': currentUser,
        'posts': posts,
        'randomDate': dailyDate
    });
});

let dailyDate = getRandomDate();

function getRandomDate() {
    const start = new Date(2011, 0, 1);
    const end = new Date();
    const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(randomTime);
}

function scheduleReset() {
    let reset = new Date();
    reset.setHours(24, 0, 0, 0);
    let t = reset.getTime() - Date.now();
    setTimeout(function() {
        dailyDate = getRandomDate();
        scheduleReset();
    }, t);
}

app.listen(port, () => {
    console.log('Now listening on port 8080...');
    scheduleReset();
});