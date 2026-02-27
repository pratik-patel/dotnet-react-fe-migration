import { Link } from "react-router-dom";
import { MvcLayout } from "../../components/shared/MvcLayout";
import { useHomeMode } from "../../hooks/useHomeMode";

export function HomeScreen() {
  const { mode } = useHomeMode();

  return (
    <MvcLayout>
      {mode === "index" ? <HomeIndex /> : null}
      {mode === "about" ? <HomeAbout /> : null}
      {mode === "contact" ? <HomeContact /> : null}
      {mode === "codeview" ? <HomeCodeView /> : null}
      {mode === "internals" ? <HomeInternals /> : null}
    </MvcLayout>
  );
}

function HomeIndex() {
  return (
    <>
      <h2>Welcome to the Sample MVC Web Application - basic version</h2>

      <p>
        <strong>
          This web site is designed as a basic interoduction to GenericServices Framework&apos;s CRUD commands
          by showing them working in an ASP.NET MVC web site.
          The <a href="https://github.com/JonPSmith/GenericServices" target="_blank" rel="noreferrer">GenericServices library</a>
          and this <a href="https://github.com/JonPSmith/SampleMvcWebApp" target="_blank" rel="noreferrer">example web site</a>
          are both open source projects by
          <a href="http://www.thereformedprogrammer.net/about-me/" target="_blank" rel="noreferrer"> Jon Smith</a> under the
          <a href="http://opensource.org/licenses/MIT" target="_blank" rel="noreferrer"> MIT licence</a>.
        </strong>
      </p>

      <h2>UPDATE for 2015</h2>
      <ul>
        <li>
          <h4>
            GenericService is now available on Nuget - see
            <a href="https://www.nuget.org/packages/GenericServices/" target="_blank" rel="noreferrer"> GenericServices on NuGet</a>.
          </h4>
        </li>
        <li>
          <h4>
            A new, more complex example is now available at
            <a href="http://complex.samplemvcwebapp.net/" target="_blank" rel="noreferrer"> Complex.SampleMvcWebApp</a>.
          </h4>
        </li>
        <li>
          <h4>
            The <a href="https://github.com/JonPSmith/GenericServices/wiki" target="_blank" rel="noreferrer">GenericServices Wiki</a>
            now contains comprehensive documentation on GenericServices.
          </h4>
        </li>
      </ul>

      <h3 className="text-info">Where should I start?</h3>
      <ul data-testid="home-index-inline-links">
        <li>
          You dive right in by clicking one of the menu links at the top of this page. Try Sync database -&gt;
          <Link to="/Posts/Index"> Posts</Link> as a start.
        </li>
        <li>
          Go to <Link to="/Home/CodeView">this page</Link> for more detail on what code features are shown on this site.
        </li>
        <li>
          You can look at the the GenericServices&apos;s
          <a href="https://github.com/JonPSmith/GenericServices/blob/master/README.md" target="_blank" rel="noreferrer"> read.me</a>
          file or SampleMvcWebApp&apos;s
          <a href="https://github.com/JonPSmith/SampleMvcWebApp/blob/master/README.md" target="_blank" rel="noreferrer"> read.me</a>
          file on GitHub.
        </li>
      </ul>

      <hr />
      <h3>Some notes about what this site is, and is not</h3>

      <h3 className="text-info">This site is about programming, not styling</h3>
      <h4 className="text-muted">The site introduces the GenericServices Framework for back-end development.</h4>
      <p>
        As much as possible the site uses the standard MVC5 BootStrap style and templates, because the main emphasis is on the back-end code.
        <br />
        I have made the styling as basic as possible, which should make it easier for you to restyle it the way you want it.
      </p>
      <small>Of course I have tried to stop it looking ugly. You can decide whether I succeeded.</small>

      <h3 className="text-info">The pages are examples, not solutions</h3>
      <h4 className="text-muted">The site demos framework commands. The data is irrelevant.</h4>
      <p>
        The aim is to show how you can use the GenericServices commands to manipulate data.
        <br />
        I have used fictitious, but credible data classes to do this. Some of the data validation rules are a somewhat bizarre to make a point.
      </p>
      <small>I have tried to make the data interesting. Enjoy.</small>

      <h3 className="text-info">The pages contain explanations</h3>
      <h4 className="text-muted">As well as showing the framework in action it includes links to explanations of the code.</h4>
      <p>
        On most pages you will see a <Link to="/Home/CodeView">Explanation of the code</Link> link. It is normally on the right hand side above the data.
        <br />
        This takes you to a page that a) has links to the actual source on GitHub and b) tries to explain how it all hangs together.
      </p>
      <small>Remember, the links to the code on GitHub are always the best documentation.</small>
    </>
  );
}

function HomeAbout() {
  return (
    <>
      <h2>About this site</h2>
      <h3>About this site</h3>
      <p>
        You should have seen on the <Link to="/Home/Index">Home Page</Link> a brief introduction to the site.
        The site is here as a testing bed/demonstration of the
        <a href="https://github.com/JonPSmith/GenericServices" target="_blank" rel="noreferrer"> GenericServices library</a>
        and a number of software patterns specific to ASP.NET MVC. All the work here is open source under the
        <a href="http://opensource.org/licenses/MIT" target="_blank" rel="noreferrer"> MIT licence</a>.
      </p>
      <p>
        The <Link to="/Home/CodeView">Introduction to GenericServices</Link> page goes into more detail about GenericServices library and some of the
        items demonstrated on this web site. I also suggest you look at GenericServices&apos;s
        <a href="https://github.com/JonPSmith/GenericServices/blob/master/README.md" target="_blank" rel="noreferrer"> read.me</a> file which gives more information.
      </p>

      <h3>Documentation</h3>
      <ul>
        <li>
          The <a href="https://github.com/JonPSmith/GenericServices/wiki" target="_blank" rel="noreferrer">GenericServices Wiki</a>
          now contains comprehensive documentation on GenericServices.
        </li>
        <li>A new, more complex example is now available at <a href="http://complex.samplemvcwebapp.net/" target="_blank" rel="noreferrer">Complex.SampleMvcWebApp</a>.</li>
      </ul>

      <h3>Related articles</h3>
      <p>I have written a number of articles/blog posts which relate to this site. They are:</p>
      <ul>
        <li><a href="http://www.thereformedprogrammer.net/alpha-release-of-genericservices/" target="_blank" rel="noreferrer">Alpha release of GenericServices</a> on my own blog site.</li>
        <li><a href="https://www.simple-talk.com/dotnet/.net-framework/catching-bad-data-in-entity-framework/" target="_blank" rel="noreferrer">Catching Bad Data in Entity Framework</a> on Simple Talk site.</li>
        <li><a href="https://www.simple-talk.com/dotnet/.net-framework/the-.net-4.5-asyncawait-commands-in-promise-and-practice/" target="_blank" rel="noreferrer">The performance of async/await in Entity Framework 6 and ASP.NET MVC5</a> on Simple Talk site.</li>
        <li><a href="https://www.simple-talk.com/dotnet/.net-framework/using-entity-framework-with-an-existing-database-data-access/" target="_blank" rel="noreferrer">Using Entity Framework With an Existing Database: Data Access</a> on Simple Talk site.</li>
        <li><a href="https://www.simple-talk.com/dotnet/asp.net/using-entity-framework-with-an-existing-database--user-interface/" target="_blank" rel="noreferrer">Using Entity Framework with an Existing Database: User Interface</a> on Simple Talk site.</li>
      </ul>

      <p>The last article in particular provides a good architectural overview of a MVC web site built Entity Framework and GenericServices.</p>
      <br />
      <p>
        <Link to="/Home/Index" data-testid="about-back-home-link">Back to Home</Link>
      </p>
    </>
  );
}

function HomeContact() {
  return (
    <>
      <h2>Contact</h2>
      <h3>About the Author</h3>
      <p>
        The author of this open-source project is Jon Smith.
        You may also be interested in my technical blog, <a href="http://www.thereformedprogrammer.net/" target="_blank" rel="noreferrer">www.thereformedprogrammer.net</a>.
        The site <a href="http://selectiveanalytics.com/" target="_blank" rel="noreferrer">Selective Analytics</a> shows some of the analytical work I have done with my wife,
        Dr Honora Smith.
      </p>
      <p>
        You can find out more about me via my <a href="http://uk.linkedin.com/pub/jon-smith/0/327/97a" target="_blank" rel="noreferrer">LinkedIn page</a>
        or my <a href="http://www.thereformedprogrammer.net/about-me/" target="_blank" rel="noreferrer">about me</a> page on my blog site.
      </p>
      <p>
        You can contact me through my <a href="http://www.thereformedprogrammer.net/" target="_blank" rel="noreferrer">Technical Blog Site</a>.
        I am available for short to medium term contracts as both a software architect and developer.
      </p>
    </>
  );
}

function HomeCodeView() {
  return (
    <>
      <h2>Introduction to GenericServices</h2>
      <p>
        GenericServices is a .NET class library which helps a developer build a
        <a href="http://martinfowler.com/eaaCatalog/serviceLayer.html" target="_blank" rel="noreferrer"> service layer</a>,
        i.e. a layer that acts as a facard/adapter between your business/data service layers and your User Interface or HTTP service.
      </p>
      <p>
        Some ASP.NET MVC specific features which build on the GenericService are also included.
        For instance the best way to call GenericService commands in a Controller and handling long-running tasks.
      </p>
      <hr />
      <h3>Summary of the features covered by this example web site</h3>
      <h4>1. Simple, but robust database services</h4>
      <p>
        See normal synchronous and async access using DTO and data class routes in Posts, PostsAsync, Tags, and TagsAsync.
      </p>
    </>
  );
}

function HomeInternals() {
  const internals = {
    workerThreads: 24,
    availableThreads: 32000,
    availableMbytes: 1536,
    heapMemoryUsedKbytes: 248192
  };

  return (
    <>
      <div>
        <h4>InternalsInfo</h4>
        <hr />
        <dl className="dl-horizontal">
          <dt>WorkerThreads</dt>
          <dd>{internals.workerThreads}</dd>

          <dt>AvailableThreads</dt>
          <dd>{internals.availableThreads}</dd>

          <dt>AvailableMbytes</dt>
          <dd>{internals.availableMbytes}</dd>

          <dt>HeapMemoryUsedKbytes</dt>
          <dd>{internals.heapMemoryUsedKbytes}</dd>
        </dl>
      </div>
      <p>
        <Link to="/Home/Index" data-testid="internals-back-link">Back to List</Link>
      </p>
    </>
  );
}
