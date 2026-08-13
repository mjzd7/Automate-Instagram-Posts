const url = "https://graph.facebook.com/v26.0/ig_audio?audio_type=music&user_id=12345&access_token=dummy";
fetch(url).then(res => res.json().then(b => console.log(res.status, b))).catch(console.error);
