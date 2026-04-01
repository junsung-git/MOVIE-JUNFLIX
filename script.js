/* ====================================================
   JUNFLIX - script.js
   ==================================================== */

'use strict';

/* ---------- CONFIG ---------- */
const API_KEY  = '802b601b17bae10ce75f3c566a4513fa';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_W500 = 'https://image.tmdb.org/t/p/w500';
const IMG_ORI  = 'https://image.tmdb.org/t/p/original';

const GENRE_MAP = {
  28:'액션', 12:'모험', 16:'애니메이션', 35:'코미디', 80:'범죄',
  99:'다큐멘터리', 18:'드라마', 10751:'가족', 14:'판타지', 36:'역사',
  27:'공포', 10402:'음악', 9648:'미스터리', 10749:'로맨스', 878:'SF',
  10770:'TV 영화', 53:'스릴러', 10752:'전쟁', 37:'서부'
};

/* ---------- INTRO ANIMATION ---------- */
function runIntro() {
  document.body.style.overflow = 'hidden';

  const screen = document.getElementById('intro-screen');
  const logo   = document.getElementById('intro-logo');

  // Phase 1: bars finish (~0.95s) → trigger glow pulse at 1.0s
  setTimeout(() => {
    logo.classList.add('glow');
  }, 1000);

  // Phase 2: fade out entire intro (at 2.2s)
  setTimeout(() => {
    screen.classList.add('fade-out');
    document.body.style.overflow = '';
  }, 2200);

  // Phase 3: remove from DOM (at 2.8s)
  setTimeout(() => {
    screen.style.display = 'none';
  }, 2800);
}


/* ---------- API FETCH HELPERS ---------- */
async function fetchMovies(endpoint) {
  try {
    const res  = await fetch(`${BASE_URL}${endpoint}&language=ko-KR`);
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('API 오류:', err);
    return [];
  }
}

async function fetchMovieDetail(id) {
  try {
    const res  = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=ko-KR`);
    return await res.json();
  } catch (err) {
    console.error('상세 정보 오류:', err);
    return null;
  }
}


/* ---------- STAR RATING ---------- */
function starsFromVote(vote) {
  const score = Math.round(vote / 2);
  const filled = '★'.repeat(Math.min(score, 5));
  const empty  = '☆'.repeat(Math.max(5 - score, 0));
  return `<span style="color:#f5c518">${filled}</span><span style="color:#555">${empty}</span>`;
}

function ratingText(vote) {
  return `${starsFromVote(vote)} <span style="color:#aaa;font-size:0.8rem">${vote.toFixed(1)}</span>`;
}


/* ---------- GENRE BADGES ---------- */
function genreBadgesHTML(ids = [], max = 2) {
  return ids.slice(0, max)
    .map(id => GENRE_MAP[id] ? `<span class="genre-badge">${GENRE_MAP[id]}</span>` : '')
    .join('');
}


/* ---------- ADULT BADGE ---------- */
function adultBadge(isAdult) {
  if (isAdult) return '<span class="badge-adult">청소년 이용불가</span>';
  return '<span class="badge-all">전체 이용가</span>';
}


/* ---------- HERO SECTION ---------- */
function initHero(movies) {
  if (!movies.length) return;

  // Pick a random movie from top 5 for variety
  const movie = movies[Math.floor(Math.random() * Math.min(5, movies.length))];

  const backdrop  = document.getElementById('hero-backdrop');
  const title     = document.getElementById('hero-title');
  const overview  = document.getElementById('hero-overview');
  const adultEl   = document.getElementById('hero-badge-adult');
  const ratingEl  = document.getElementById('hero-rating-badge');
  const playBtn   = document.getElementById('hero-play-btn');
  const infoBtn   = document.getElementById('hero-info-btn');

  if (movie.backdrop_path) {
    backdrop.style.backgroundImage = `url('${IMG_ORI}${movie.backdrop_path}')`;
  }

  title.textContent    = movie.title || movie.original_title;
  overview.textContent = movie.overview || '줄거리 정보가 없습니다.';
  adultEl.innerHTML    = adultBadge(movie.adult);
  ratingEl.textContent = `평점 ${movie.vote_average?.toFixed(1) || 'N/A'}`;

  // Hero buttons -> open modal
  playBtn.addEventListener('click', () => openModal(movie.id));
  infoBtn.addEventListener('click', () => openModal(movie.id));
}


/* ---------- CARD BUILDER ---------- */
function buildCard(movie) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', movie.title);

  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
  const posterSrc = movie.poster_path
    ? `${IMG_W500}${movie.poster_path}`
    : null;

  card.innerHTML = `
    <div class="movie-card-inner">
      ${posterSrc
        ? `<img src="${posterSrc}" alt="${movie.title}" loading="lazy" />`
        : `<div class="no-poster">포스터 없음</div>`
      }
      <div class="card-overlay">
        <p class="card-title">${movie.title || movie.original_title}</p>
        <div class="card-meta">
          <span class="card-rating">★ ${movie.vote_average?.toFixed(1) || 'N/A'}</span>
          <span class="card-year">${year}</span>
        </div>
        <div class="card-genres">${genreBadgesHTML(movie.genre_ids)}</div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(movie.id));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') openModal(movie.id);
  });

  return card;
}


/* ---------- SLIDER INIT ---------- */
function initSlider(trackId, movies, btnLeftSel, btnRightSel) {
  const track   = document.getElementById(trackId);
  const btnLeft = document.querySelector(btnLeftSel);
  const btnRight= document.querySelector(btnRightSel);

  if (!track) return;

  // Clear skeletons, render cards
  track.innerHTML = '';
  movies.forEach(m => track.appendChild(buildCard(m)));

  let offset = 0;
  const CARD_W = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 180;
  const GAP    = 10;
  const STEP   = (CARD_W + GAP) * 4; // scroll 4 cards at a time

  const maxOffset = () => {
    const wrapW = track.parentElement.clientWidth;
    const totalW = movies.length * (CARD_W + GAP) - GAP;
    return Math.max(0, totalW - wrapW);
  };

  if (btnLeft) {
    btnLeft.addEventListener('click', () => {
      offset = Math.max(0, offset - STEP);
      track.style.transform = `translateX(-${offset}px)`;
    });
  }

  if (btnRight) {
    btnRight.addEventListener('click', () => {
      offset = Math.min(maxOffset(), offset + STEP);
      track.style.transform = `translateX(-${offset}px)`;
    });
  }
}


/* ---------- SKELETON LOADERS ---------- */
function renderSkeletons(trackId, count = 8) {
  const track = document.getElementById(trackId);
  if (!track) return;
  track.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton skeleton-card';
    track.appendChild(sk);
  }
}


/* ---------- MODAL ---------- */
const modalOverlay = document.getElementById('modal-overlay');
const modalEl      = document.getElementById('modal');

async function openModal(movieId) {
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Reset content while loading
  document.getElementById('modal-title').textContent    = '불러오는 중...';
  document.getElementById('modal-overview').textContent = '';
  document.getElementById('modal-release').textContent  = '';
  document.getElementById('modal-rating').innerHTML     = '';
  document.getElementById('modal-genres').textContent   = '';
  document.getElementById('modal-lang').textContent     = '';
  document.getElementById('modal-year').textContent     = '';
  document.getElementById('modal-runtime').textContent  = '';
  document.getElementById('modal-adult-badge').innerHTML= '';
  document.getElementById('modal-backdrop').src         = '';

  const movie = await fetchMovieDetail(movieId);
  if (!movie) return;

  // Backdrop
  const backdropImg = document.getElementById('modal-backdrop');
  if (movie.backdrop_path) {
    backdropImg.src = `${IMG_ORI}${movie.backdrop_path}`;
    backdropImg.alt = movie.title;
  } else if (movie.poster_path) {
    backdropImg.src = `${IMG_W500}${movie.poster_path}`;
    backdropImg.alt = movie.title;
  }

  // Info
  document.getElementById('modal-title').textContent    = movie.title || movie.original_title;
  document.getElementById('modal-overview').textContent = movie.overview || '줄거리 정보가 없습니다.';
  document.getElementById('modal-release').textContent  = movie.release_date || '-';
  document.getElementById('modal-rating').innerHTML     = ratingText(movie.vote_average || 0);
  document.getElementById('modal-genres').textContent   = movie.genres?.map(g => g.name).join(', ') || '-';
  document.getElementById('modal-lang').textContent     = movie.original_language?.toUpperCase() || '-';
  document.getElementById('modal-year').textContent     = movie.release_date?.slice(0,4) || '';
  document.getElementById('modal-runtime').textContent  = movie.runtime ? `${movie.runtime}분` : '';
  document.getElementById('modal-adult-badge').innerHTML= adultBadge(movie.adult);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});


/* ---------- NAVBAR SCROLL ---------- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });


/* ---------- SEARCH TOGGLE ---------- */
const searchBtn  = document.getElementById('search-btn');
const searchWrap = document.getElementById('search-bar-wrap');
const searchInput= document.getElementById('search-input');

searchBtn.addEventListener('click', () => {
  searchWrap.classList.toggle('hidden');
  if (!searchWrap.classList.contains('hidden')) {
    searchInput.focus();
  }
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    searchWrap.classList.add('hidden');
  }
});


/* ---------- MAIN INIT ---------- */
async function init() {
  // Start intro immediately
  runIntro();

  // Render skeleton loaders
  renderSkeletons('movie-slider', 10);
  renderSkeletons('top-rated-slider', 10);

  // Fetch data in parallel
  const [nowPlaying, topRated] = await Promise.all([
    fetchMovies(`/movie/now_playing?api_key=${API_KEY}&page=1`),
    fetchMovies(`/movie/top_rated?api_key=${API_KEY}&page=1`)
  ]);

  // Hero
  initHero(nowPlaying);

  // Now Playing slider
  initSlider(
    'movie-slider',
    nowPlaying,
    '#now-playing-section .slider-btn-left',
    '#now-playing-section .slider-btn-right'
  );

  // Top Rated slider
  initSlider(
    'top-rated-slider',
    topRated,
    '#top-rated-section .slider-btn-left',
    '#top-rated-section .slider-btn-right'
  );
}

// Run
init();
