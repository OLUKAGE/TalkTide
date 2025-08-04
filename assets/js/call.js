const APP_ID = "a988416fe69e44af9bd13e9987435059";
const TOKEN = "007eJxTYFB58+oy38K70ee36dyNTatSizc2m3NeqUZ0YaSGm5blXyUFhkRLCwsTQ7O0VDPLVBOTxDTLpBRD41RLSwtzE2NTA1PLmwkTMhoCGRm0qgoYGRkgEMRnYUhOzMlhYAAA+Lcdmg=="

function getMeetingCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('meeting') || "call";
}

const CHANNEL = getMeetingCode();

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

let localTracks = []
let remoteUsers = {}

let joinAndDisplayLocalStream = async () => {

    client.on('user-published', handleUserJoined)
    
    client.on('user-left', handleUserLeft)
    
    let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks() 

    let player = `<div class="video-container" id="user-container-${UID}">
                        <div class="video-player" id="user-${UID}"></div>
                  </div>`
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

    localTracks[1].play(`user-${UID}`)
    
    await client.publish([localTracks[0], localTracks[1]])
}

let startStream = async () => {
    await joinAndDisplayLocalStream()
    document.getElementById('new-call').style.display = 'none' // Hide the whole new-call div
    document.getElementById('stream-controls').style.display = 'flex'
}

let handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user 
    await client.subscribe(user, mediaType)

    if (mediaType === 'video'){
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player != null){
            player.remove()
        }

        player = `<div class="video-container" id="user-container-${user.uid}">
                        <div class="video-player" id="useaqr-${user.uid}"></div> 
                 </div>`
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio'){
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()
}

let leaveAndRemoveLocalStream = async () => {
    for(let i = 0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()
    }

    await client.leave()
    document.getElementById('new-call').style.display = 'block' // Show the new-call div again
    document.getElementById('stream-controls').style.display = 'none'
    document.getElementById('video-streams').innerHTML = ''
}

let toggleMic = async (e) => {
    if (localTracks[0].muted){
        await localTracks[0].setMuted(false)
        e.target.innerText = 'Mic on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[0].setMuted(true)
        e.target.innerText = 'Mic off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

let toggleCamera = async (e) => {
    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)
        e.target.innerText = 'Camera on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[1].setMuted(true)
        e.target.innerText = 'Camera off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}


// Utility to get and set call history in localStorage
function getCallHistory() {
    return JSON.parse(localStorage.getItem('callHistory') || '[]');
}
function setCallHistory(history) {
    // Sort by ended time (most recent first), fallback to started if ended is missing
    history.sort((a, b) => {
        const aTime = a.ended || a.started;
        const bTime = b.ended || b.started;
        return bTime - aTime;
    });
    // Keep only the 10 most recent
    localStorage.setItem('callHistory', JSON.stringify(history.slice(0, 10)));
}

// Render call history in the stream wrapper
function renderCallHistory() {
    const history = getCallHistory(); // Already sorted by setCallHistory
    const container = document.getElementById('call-history');
    if (!container) return;
    if (history.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#888; padding:40px;">No recent calls.</div>`;
        return;
    }
    container.innerHTML = `
        <table style="width:100%; background:#fff0; color:#333; border-collapse:collapse;">
            <thead>
                <tr style="background:#e0e7ff;">
                    <th style="padding:8px;">#</th>
                    <th style="padding:8px;">Channel</th>
                    <th style="padding:8px;">Started</th>
                    <th style="padding:8px;">Ended</th>
                </tr>
            </thead>
            <tbody>
                ${history.map((call, i) => `
                    <tr style="border-bottom:1px solid #e0e7ff;">
                        <td style="padding:8px;">${i + 1}</td>
                        <td style="padding:8px;">${call.channel}</td>
                        <td style="padding:8px;">${call.started ? new Date(call.started).toLocaleString() : '-'}</td>
                        <td style="padding:8px;">${call.ended ? new Date(call.ended).toLocaleString() : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Show history and hide video streams
function showHistory() {
    document.getElementById('call-history').style.display = 'block';
    document.getElementById('video-streams').style.display = 'none';
}

// Show video streams and hide history
function showVideoStreams() {
    document.getElementById('call-history').style.display = 'none';
    document.getElementById('video-streams').style.display = 'grid';
}

// Track call start/end
let currentCall = null;

// When a call is started or joined
async function startOrJoinCall() {
    currentCall = {
        channel: CHANNEL,
        started: Date.now(),
        ended: null
    };
    showVideoStreams();
    await joinAndDisplayLocalStream();
    document.getElementById('new-call').style.display = 'none';
    document.getElementById('stream-controls').style.display = 'flex';
}

// When a call is left
async function leaveAndRemoveLocalStreamWithHistory() {
    if (currentCall) {
        currentCall.ended = Date.now();
        const history = getCallHistory();
        history.unshift(currentCall); // Add to the front
        setCallHistory(history);
        currentCall = null;
    }
    for(let i = 0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()
    }
    await client.leave()
    document.getElementById('new-call').style.display = 'block'
    document.getElementById('stream-controls').style.display = 'none'
    document.getElementById('video-streams').innerHTML = ''
    showHistory();
    renderCallHistory();
}

// --- Replace your event listeners ---
document.getElementById('start-btn').addEventListener('click', startOrJoinCall);
document.getElementById('join-btn').addEventListener('click', startOrJoinCall);
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStreamWithHistory);
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('share-btn').addEventListener('click', function() {
    // Generate a unique code (8 characters)
    const code = getMeetingCode();
    // Build the shareable link
    const url = `${window.location.origin}${window.location.pathname}?meeting=${code}`;
    // Show the link to the user (prompt or copy to clipboard)
    window.prompt("Share this link to invite others to your call:", url);
});


// On page load, show history and hide stream controls
renderCallHistory();
showHistory();
document.getElementById('stream-controls').style.display = 'none';


