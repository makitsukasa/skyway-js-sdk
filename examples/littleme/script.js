const Peer = window.Peer;
const localExpression = document.getElementById("local-expression");
const localVideo = document.getElementById('js-local-stream');
var mediaConnection = null;
var dataConnection = null;

const userMedia = navigator.mediaDevices.getUserMedia({
  video: true,
  audio: false,
})
.catch(console.error);

localVideo.muted = true;
var localStream = null;

userMedia.then(stream => {
  localVideo.srcObject = stream;
  localStream = stream;
});
localVideo.playsInline = true;
localVideo.play().catch(console.error);

// clmtrackr の開始
var tracker = new window.clm.tracker();  // tracker オブジェクトを作成
tracker.init(pModel);             // tracker を所定のフェイスモデル（※1）で初期化
tracker.start(localVideo);        // video 要素内でフェイストラッキング開始

// 感情分類の開始
var classifier = new emotionClassifier();               // ★emotionClassifier オブジェクトを作成
classifier.init(emotionModel);                          // ★classifier を所定の感情モデル（※2）で初期化

function postHttpRequest(){
  var data = { param1: 'abc', param2: 100 }; // POSTメソッドで送信するデータ

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

  xmlHttpRequest.open('GET', '192.168.11.100:8888');

  // サーバに対して解析方法を指定する
  xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

  // データをリクエスト ボディに含めて送信する
  xmlHttpRequest.send(EncodeHTMLForm( data ));
}

// ★感情データの表示
function showEmotionData(emo) {
  var str ="";                                          // データの文字列を入れる変数
  for(var i = 0; i < emo.length; i++) {                 // 全ての感情（6種類）について
    str += emo[i].emotion + ": "                        // 感情名
        + emo[i].value.toFixed(3) + "<br>";             // 感情の程度（小数第3位まで）
  }
  localExpression.innerHTML = str;                      // データ文字列の表示
}

// 描画ループ
function drawLoop() {
  requestAnimationFrame(drawLoop);                      // drawLoop 関数を繰り返し実行
  var positions = tracker.getCurrentPosition();         // 顔部品の現在位置の取得
  if(positions){
    var parameters = tracker.getCurrentParameters();      // ★現在の顔のパラメータを取得
    var emotion = classifier.meanPredict(parameters);     // ★そのパラメータから感情を推定して emotion に結果を入れる
    showEmotionData(emotion);                             // ★感情データを表示
    try{
      dataConnection.send("hoge");
      // postHttpRequest();
    }
    catch(e){
      console.log("cahched error: ", e);
    }
  }
  else{
    localExpression.innerHTML = "no face detected<br><br><br><br><br><br>";  // データ文字列の表示
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
      dataConnection.send("opened");
    });

    dataConnection.on('data', data => {
      console.log(`Remote: ${data}\n`);
    });

    dataConnection.once('close', () => {
      console.log(`=== DataConnection has been closed ===\n`);
    });
  });

  peer.on('error', console.error);

})();
