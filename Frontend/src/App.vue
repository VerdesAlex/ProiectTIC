<template>
  <div class="app-wrapper">
    <router-view />
  </div>
</template>

<style>
/* Stiluri globale */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #343541; /* Dark mode global */
  color: #ffffff;
}
.app-wrapper {
  height: 100vh;
  width: 100vw;
}
</style>