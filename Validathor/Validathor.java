/******************************************************************************
 *  Compilation:  javac Validathor.java
 *  Execution:    java Validathor [programyouwanttocompile.java] [path_to_output_directory]
 *
 *  Tries to compile inputed java class.
 *
 *
 ******************************************************************************/
import java.util.*;
import java.io.*;

public class Validathor {

  private static PrintWriter writer;
  private static String errors = "";;

  private static void printLines(String name, InputStream ins) throws Exception {
    String line = null;
    BufferedReader in = new BufferedReader(
        new InputStreamReader(ins));

    while ((line = in.readLine()) != null) 
	{
		line = line.replace("\\", "/");
		errors+= "\""+ line.replaceAll("\"","\\\\\"")+"\",";	
    }
  }

  private static void runProcess(String command) throws Exception {
    Process pro = Runtime.getRuntime().exec(command);
    //printLines(command + " stdout:", pro.getInputStream());
    printLines("stderr:", pro.getErrorStream());
    pro.waitFor();
  }

  public static void main(String[] args) 
  {
	if(args.length==2)
	{
		File targetFile = new File(args[1]);
		File parent = targetFile.getParentFile();

		try { writer = new PrintWriter(targetFile, "UTF-8"); }
		catch(IOException io) { System.out.println("Error creating report file: "+args[1]); return; }
		
		try 
		{
		  runProcess("javac -d "+args[0].substring(0,args[0].lastIndexOf('/'))+" "+args[0]);
		  runProcess("java -cp "+args[0].substring(0,args[0].lastIndexOf('/'))+" "+args[0].substring(args[0].lastIndexOf('/')+1,args[0].length()-5));
		  if(errors.length()>0)
		  {
			errors = errors.substring(0, errors.length()-1);
			errors = "{\"error_list\": ["+errors+"] }";
			writer.println(errors);
		  }
		  else
		  {
			errors = "{\"error_list\": [] }";
			writer.println(errors);
		  }
			
		   errors = null;
		} 
		catch (Exception e) 
		{
			e.printStackTrace();	
		}
		writer.close();
	}
	else
		System.out.println("Error, invalid startup. Run the program with command: \njava Validathor [programyouwanttocompile.java] [path_to_output_directory]");
  }
}