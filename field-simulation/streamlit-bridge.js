// Display-only Streamlit protocol. Never sends component values or app actions.
(()=>{
  if(window.parent===window)return;
  let connected=false;
  function size(){
    if(!connected)return;
    const width=document.documentElement.clientWidth;
    const height=Math.max(520,Math.min(850,Math.round(width*.61+160)));
    parent.postMessage({isStreamlitMessage:true,type:'streamlit:setFrameHeight',height},'*');
  }
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.type!=='streamlit:render')return;
    connected=true;size();
  });
  addEventListener('resize',size);
  parent.postMessage({isStreamlitMessage:true,type:'streamlit:componentReady',apiVersion:1},'*');
})();
