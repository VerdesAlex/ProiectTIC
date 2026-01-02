<template>
  <div id="app">
    <h1>LocalMind AI</h1>
    <hr />
    <AuthTest />
  </div>
</template>

<script setup>
import AuthTest from './components/AuthTest.vue'
</script>

<style>
/* Basic styling just to make it readable */
#app {
  font-family: sans-serif;
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}
input { display: block; width: 100%; margin-bottom: 10px; padding: 8px; }
button { margin-right: 10px; padding: 8px 16px; cursor: pointer; }
</style>