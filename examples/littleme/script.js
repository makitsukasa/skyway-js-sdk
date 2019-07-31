const Peer = window.Peer;
const localExpression = document.getElementById("local-expression");
const remoteExpression = document.getElementById("remote-expression");
const localVideo = document.getElementById('js-local-stream');
var localStream = null;
var mediaConnection = null;
var dataConnection = null;
var analyser = null;
var remoteEmotion = [0, 0, 0];

const userMedia = navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
})
.catch(console.error);

localVideo.muted = true;
localVideo.playsInline = true;
localVideo.play().catch(console.error);

var audioContext = new AudioContext();
analyser = audioContext.createAnalyser();
analyser.fftSize = 32;

userMedia.then(stream => {
  localVideo.srcObject = stream;
  localStream = stream;
  var source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
});

// clmtrackr の開始
var tracker = new window.clm.tracker();  // tracker オブジェクトを作成
tracker.init(pModel);             // tracker を所定のフェイスモデル（※1）で初期化
tracker.start(localVideo);        // video 要素内でフェイストラッキング開始

// 感情分類の開始
var classifier = new emotionClassifier();               // ★emotionClassifier オブジェクトを作成
classifier.init(emotionModel);                          // ★classifier を所定の感情モデル（※2）で初期化

function postHttpRequest(emo1){
  var xmlHttpRequest = new XMLHttpRequest();
  xmlHttpRequest.onreadystatechange = function()
  {
      var READYSTATE_COMPLETED = 4;
      var HTTP_STATUS_OK = 200;

      if( this.readyState == READYSTATE_COMPLETED
      && this.status == HTTP_STATUS_OK )
      {
          // レスポンスの表示
          alert( this.responseText );
      }
  }

  xmlHttpRequest.open('GET', `http://192.168.43.112:8888/?r1=${emo[0]}&g1=${emo[1]}&b1=${emo[2]}&r2=${remoteEmotion[0]}&g2=${remoteEmotion[1]}&b2=${remoteEmotion[2]}`);

  // サーバに対して解析方法を指定する
  xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

  xmlHttpRequest.send();
}

function getVolume() {
  var bit8 = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bit8);

  ans = 0;
  for(var i = 3; i < 15; i++){
    ans += bit8[i];
  }
  return ans;

  // return bit8.reduce(function(previous, current) {
  //   return previous + current;
  // }) / analyser.frequencyBinCount;
};

function getEmotionColor(emo){
  var dic = {
    "angry": [1, 0, 0],
    "disgusted": [0, 1, 0],
    "fear": [0, 1, 1],
    "sad": [0, 0, 1],
    "surprised": [1, 0, 1],
    "happy": [1, 1, 0],
    "voice": [0, 0, 0],
  };
  color = [0, 0, 0];
  for(var i = 0; i < emo.length; i++) {                 // 全ての感情（6種類）について
    for(var j = 0; j < 3; j++){
      color[j] += dic[emo[i].emotion][j] * emo[i].value;
      if(color[j] > 1){
        color[j] = 1
      }
    }
  }
  return color;
}

function rgb2hex( rgb ){
	return "#" + rgb.map(function (value) {
		return ("0" + Math.round(value * 255).toString( 16 ) ).slice( -2 );
	} ).join("");
}

// ★感情データの表示
function getEmotionData(emo) {
  var str ="";                                          // データの文字列を入れる変数
  for(var i = 0; i < emo.length; i++) {                 // 全ての感情（6種類）について
    str += emo[i].emotion + ": "                        // 感情名
        + emo[i].value.toFixed(3) + "<br>";             // 感情の程度（小数第3位まで）
  }
  return str;                      // データ文字列の表示
}

// 描画ループ
function drawLoop() {
  requestAnimationFrame(drawLoop);                      // drawLoop 関数を繰り返し実行
  var positions = tracker.getCurrentPosition();         // 顔部品の現在位置の取得
  if(positions){
    var parameters = tracker.getCurrentParameters();      // ★現在の顔のパラメータを取得
    var emotion = classifier.meanPredict(parameters);     // ★そのパラメータから感情を推定して emotion に結果を入れる
    emotion.push({emotion: "voice", value: getVolume()});
    localExpression.innerHTML = getEmotionData(emotion);                             // ★感情データを表示
    localExpression.style.background = rgb2hex(getEmotionColor(emotion));
    try{
      dataConnection.send(JSON.stringify(emotion));
      postHttpRequest(JSON.stringify(getEmotionColor(emotion)));
    }
    catch(e){
      console.log("cahched error: ", e);
    }
  }
  else{
    localExpression.innerHTML = String(getVolume()) + "<br><br><br><br><br><br>";
    localExpression.style.background = "white";
  }
}
drawLoop();                                             // drawLoop 関数をトリガー

(async function main() {
  const localId = document.getElementById('js-local-id');
  const callTrigger = document.getElementById('js-call-trigger');
  const closeTrigger = document.getElementById('js-close-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
  const remoteId = document.getElementById('js-remote-id');

  const peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  });

  // Register caller handler
  callTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    mediaConnection = peer.call(remoteId.value, localStream);
    dataConnection = peer.connect(remoteId.value);

    mediaConnection.on('stream', async stream => {
      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    });

    closeTrigger.addEventListener('click', () => mediaConnection.close(true));
  });

  peer.once('open', id => (localId.textContent = id));

  // Register callee handler
  peer.on('call', mediaConnection => {
    mediaConnection.answer(localStream);

    mediaConnection.on('stream', async stream => {
      // Render remote stream for callee
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    });

    closeTrigger.addEventListener('click', () => {
      mediaConnection.close(true);
      dataConnection.close(true);
    });
  });

  peer.on('connection', dataConnection => {
    dataConnection.once('open', async () => {
      console.log(`=== DataConnection has been opened ===\n`);
    });

    dataConnection.on('data', data => {
      emotion = JSON.parse(data);
      console.log(`Remote: ${emotion}\n`);
      remoteExpression.innerHTML = getEmotionData(emotion);                             // ★感情データを表示
      remoteExpression.style.background = rgb2hex(getEmotionColor(emotion));
      remoteEmotion = getEmotionColor(emotion);
    });

    dataConnection.once('close', () => {
      console.log(`=== DataConnection has been closed ===\n`);
    });
  });

  peer.on('error', console.error);

})();
