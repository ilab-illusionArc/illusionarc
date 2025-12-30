<template>
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div class="glow g1" />
    <div class="glow g2" />
    <div class="glow g3" />
  </div>
</template>

<style scoped>
.glow{
  position:absolute;
  width:900px;
  height:600px;
  border-radius:999px;
  filter: blur(60px);
  opacity:.25;
}
.g1{ left:-220px; top:-220px; background: rgba(124,58,237,.9); }
.g2{ right:-260px; top:-120px; background: rgba(34,211,238,.8); }
.g3{ left:20%; bottom:-280px; background: rgba(34,197,94,.65); opacity:.18; }
</style>
