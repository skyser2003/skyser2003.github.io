<script setup lang="ts">
import init, { greet } from "../models/pkg/gh_pages_rust.js";
import lm from "../models/language/lang_manager";

defineProps<{
  msg: string;
}>();

await init();
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ lm.getData("name") }}</h1>
    <h3>{{ lm.getData("mlops") }}</h3>
    <h3>{{ lm.getData("ai_engineer") }}</h3>
    <h3>{{ lm.getData("web_backend_developer") }}</h3>
    <br/>
    <h3>Contact: <a href="mailto:shjang1992@gmail.com">shjang1992@gmail.com</a></h3>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
  position: relative;
  top: -10px;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
