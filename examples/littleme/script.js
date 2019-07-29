const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const localId = document.getElementById('js-local-id');
  const callTrigger = document.getElementById('js-call-trigger');
  const closeTrigger = document.getElementById('js-close-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
  const remoteId = document.getElementById('js-remote-id');
  const localExpression = document.getElementById("localExpression");

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

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

    const mediaConnection = peer.call(remoteId.value, localStream);

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

    closeTrigger.addEventListener('click', () => mediaConnection.close(true));
  });

  peer.on('error', console.error);

  // clmtrackr の開始
  var tracker = new clm.tracker();  // tracker オブジェクトを作成
  tracker.init(pModel);             // tracker を所定のフェイスモデル（※1）で初期化
  tracker.start(localVideo);        // video 要素内でフェイストラッキング開始

  // 感情分類の開始
  var classifier = new emotionClassifier();               // ★emotionClassifier オブジェクトを作成
  classifier.init(emotionModel);                          // ★classifier を所定の感情モデル（※2）で初期化

  // 描画ループ
  function drawLoop() {
    requestAnimationFrame(drawLoop);                      // drawLoop 関数を繰り返し実行
    var positions = tracker.getCurrentPosition();         // 顔部品の現在位置の取得
    var parameters = tracker.getCurrentParameters();      // ★現在の顔のパラメータを取得
    var emotion = classifier.meanPredict(parameters);     // ★そのパラメータから感情を推定して emotion に結果を入れる
    showEmotionData(emotion);                             // ★感情データを表示
  }
  drawLoop();                                             // drawLoop 関数をトリガー

  // ★感情データの表示
  function showEmotionData(emo) {
    var str ="";                                          // データの文字列を入れる変数
    for(var i = 0; i < emo.length; i++) {                 // 全ての感情（6種類）について
      str += emo[i].emotion + ": "                        // 感情名
          + emo[i].value.toFixed(1) + "<br>";            // 感情の程度（小数第一位まで）
    }
    localExpression.innerHTML = str;                                  // データ文字列の表示
  }
})();
