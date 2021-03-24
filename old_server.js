




/*
const http = require('http');
const { parse } = require('querystring');

const pagesrc = `
<html>
 <head>
 </head>
 <body>
  <h1> Test Form </h1>
  <form method="POST" target="./submit.html">
   What is your name? <br>
   <input type='text' id='name'></input>
   <br>
   <input type="submit"> Go </input>
 </body>
</html>
`

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