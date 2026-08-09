### **১. SSE (Server-Sent Events) কিভাবে কাজ করাবেন?**

এডিটর বা ক্লায়েন্ট তখনই কথা শুনবে যখন সার্ভার থেকে ডাটা **স্ট্রিমিং (Streaming)** আকারে আসবে। এটার জন্য আপনার লারাভেল বা নোড জেএস ব্যাকএন্ডে এই হেডারগুলো মাস্ট:

HTTP  
Content-Type: text/event-stream  
Cache-Control: no-cache  
Connection: keep-alive

**এডিটর কেন কথা শোনে না?** যদি আপনার পক্সি (Nginx/Apache) বা কোনো মিডলওয়্যার ডাটাকে **বাফারিং (Buffering)** করে আটকে রাখে, তবে এডিটর কিছুই পাবে না যতক্ষণ না পুরো রেসপন্স শেষ হচ্ছে। তাই `X-Accel-Buffering: no` হেডারটা যোগ করা জরুরি।

### **২. ইউনিক সকেট ডোমেইন (Unix Domain Socket \- UDS) কিভাবে করবেন?**

ইউনিক সকেট হলো ইন্টারনেটের বদলে সরাসরি ফাইল সিস্টেমে ডাটা আদান-প্রদান করা। এটি টিসিপি (TCP) সকেটের চেয়ে অনেক বেশি ফাস্ট এবং সিকিউর।

**কিভাবে করবেন:** ১. **ফাইল পাথ ঠিক করা:** সকেট ফাইলটা সাধারণত `/tmp/` বা প্রজেক্টের ভেতরের কোনো ফোল্ডারে থাকে। যেমন: `/tmp/zombiecoder.sock` ২. **সার্ভার কনফিগারেশন:**

* যদি **Ollama** বা আপনার নিজের কোনো সকেট সার্ভার হয়, তবে হোস্ট হিসেবে `http://localhost` না লিখে সকেট পাথটা বলে দিতে হয়।  
* **Node.js** উদাহরণ:  
* JavaScript

const server \= net.createServer((socket) \=\> { ... });  
server.listen('/tmp/zombiecoder.sock'); // এখানে সকেট ফাইলে লিসেন করছে

*   
* 

### **৩. এডিটরকে কিভাবে শোনাবেন? (The Protocol Link)**

এডিটরকে ইউনিক সকেটের কথা বোঝাতে হলে আপনার **MCP (Model Context Protocol)** বা লোকাল গেটওয়েতে সকেটের পাথটা ধরিয়ে দিতে হবে।

* **আপনার ডায়াগনস্টিক রিপোর্ট** অনুযায়ী, অনেক সময় এডিটর লোকাল সকেটে কানেক্ট হতে গিয়ে ফেইল করে।  
* **সমাধান:** সকেট ফাইলের **পারমিশন (Permissions)** চেক করুন। `chmod 777 /tmp/zombiecoder.sock` দিয়ে দেখুন এডিটর এক্সেস পায় কি না।

### **১. সকেট টু টিসিপি ব্রিজ (The Bridge Strategy)**

অধিকাংশ এডিটর (যেমন VS Code বা এডিটর প্লাগইন) সরাসরি ইউনিক সকেট ফাইল (`.sock`) রিড করতে পারে না; তারা আশা করে একটি **HTTP/TCP Localhost** ইউআরএল। **সমাধান:** আপনার নোড জেএস বা বুন (Bun) সার্ভারটি ইউনিক সকেটে লিসেন করবে ঠিকই, কিন্তু সামনে একটি **Caddy** বা **Nginx** রিভার্স প্রক্সি রাখুন।

**Caddy কনফিগারেশন (ইন্ডাস্ট্রি স্ট্যান্ডার্ড):**

Code snippet  
:9999 {  
    reverse\_proxy unix//tmp/zombiecoder.sock {  
        header\_up Host {host}  
        header\_up X-Real-IP {remote\_host}  
          
        \# SSE এর জন্য বাফারিং বন্ধ করা  
        flush\_interval \-1  
    }  
}

এটি করলে এডিটর কানেক্ট হবে `http://localhost:9999` এ, কিন্তু ডাটা আদান-প্রদান হবে অতি দ্রুত গতিতে আপনার ইউনিক সকেট দিয়ে।

### **২. SSE স্ট্রিমিং-এর "Chunked" লজিক**

সার্ভার থেকে হেডার পাঠালেই হবে না, ডাটা পাঠানোর সময় আপনাকে `Write` এবং `Flush` মেকানিজম ব্যবহার করতে হবে। নোড জেএস-এ ডাটা পাঠানোর সাথে সাথে `response.flush()` বা `response.write()` ব্যবহার না করলে এডিটর সেটা বাফারে জমা করে রাখে।

**Node.js এ সঠিক স্ট্রিমিং উদাহরণ:**

JavaScript  
res.writeHead(200, {  
    'Content-Type': 'text/event-stream',  
    'Cache-Control': 'no-cache',  
    'Connection': 'keep-alive',  
    'X-Accel-Buffering': 'no' // এনজিনেক্স বাফারিং বন্ধ করতে  
});

// ডাটা পাঠানোর সময় 'data: ' প্রিফিক্স এবং ডাবল নিউলাইন মাস্ট  
const sendData \= (data) \=\> {  
    res.write(\`data: ${JSON.stringify(data)}\\n\\n\`);  
    // যদি কমপ্রেশন মিডলওয়্যার থাকে তবে flush() কল করা জরুরি  
    if (res.flush) res.flush();   
};

### **৩. ফাইল পারমিশন এবং "Socket Cleanup"**

ইউনিক সকেট সার্ভার যখন রিস্টার্ট হয়, তখন পুরনো `.sock` ফাইলটি ডিলিট না হলে নতুন সার্ভার স্টার্ট হতে পারে না এবং এডিটর পুরনো "Dead Socket" এ নক করতে থাকে।

**সঠিক স্টার্টআপ স্ক্রিপ্ট:**

JavaScript  
const fs \= require('fs');  
const socketPath \= '/tmp/zombiecoder.sock';

// পুরনো সকেট মুছে ফেলা (Cleanup)  
if (fs.existsSync(socketPath)) {  
    fs.unlinkSync(socketPath);  
}

server.listen(socketPath, () \=\> {  
    // পারমিশন সেট করা যেন এডিটর এক্সেস পায়  
    fs.chmodSync(socketPath, '0777');   
    console.log(\`ZombieCoder logic running on ${socketPath}\`);

