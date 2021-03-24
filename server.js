


const express = require('express');
const bodyParser = require('body-parser');
const app = express();


const pagesrc = `
<html>
 <head>
 </head>
 <body>
  <h1> Test Form </h1>
  <form method="POST" action="./submit/">
   What is your name? <br>
   <input type='text' name='name'></input>
   <br>
   <input type="submit" value="Go"></input>
 </body>
</html>
`

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
  res.send(pagesrc)
})

app.post('/submit', function (req, res) {
  console.log(req.body);
  res.send(`Hello ${req.body.name}`);
})

app.listen(3000);

/*
const http = require('http');
const { parse } = require('querystring');

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        collectRequestData(req, result => {
            console.log(result);
            res.end(`Parsed data belonging to ${result.fname}`);
        });
    } 
    else {
        res.end(pagesrc);
    }
});
server.listen(3000);

function collectRequestData(request, callback) {
    const FORM_URLENCODED = 'application/x-www-form-urlencoded';
    if(request.headers['content-type'] === FORM_URLENCODED) {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            callback(parse(body));
        });
    }
    else {
        callback(null);
    }
}
*/