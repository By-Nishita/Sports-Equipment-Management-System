import './TypeThumb.css';

// The photo of an equipment type. With no photo yet, shows the first letter of its name.
// size is in pixels.
function TypeThumb({ type, size = 56 }) {
  const src = type?.thumbUrl || type?.imageUrl;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };

  return src ? (
    <img className="type-thumb" src={src} alt="" style={style} loading="lazy" />
  ) : (
    <span className="type-thumb type-thumb-letter" style={style} aria-hidden="true">
      {(type?.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

export default TypeThumb;